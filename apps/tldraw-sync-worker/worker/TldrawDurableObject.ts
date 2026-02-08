import { RoomSnapshot, TLSocketRoom } from '@tldraw/sync-core'
import {
	TLRecord,
	createTLSchema,
	defaultBindingSchemas,
	defaultShapeSchemas,
} from '@tldraw/tlschema'
import { AutoRouter, IRequest, error } from 'itty-router'
import throttle from 'lodash.throttle'
import { Environment } from './types'

type RoomSchemaConfig = {
	shapeTypes: string[]
	bindingTypes: string[]
}

const STORAGE_SCHEMA_CONFIG_KEY = 'schemaConfig'

const createRoomSchema = ({ shapeTypes, bindingTypes }: RoomSchemaConfig) => {
	const customShapeSchemas = Object.fromEntries(shapeTypes.map((type) => [type, {}]))
	const customBindingSchemas = Object.fromEntries(bindingTypes.map((type) => [type, {}]))

	return createTLSchema({
		shapes: {
			...defaultShapeSchemas,
			...customShapeSchemas,
		},
		bindings: {
			...defaultBindingSchemas,
			...customBindingSchemas,
		},
	})
}

const dedupeAndSort = (values: string[]): string[] => {
	return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
		a.localeCompare(b)
	)
}

const mergeSchemaConfig = (
	baseConfig: RoomSchemaConfig,
	incomingConfig: RoomSchemaConfig
): RoomSchemaConfig => ({
	shapeTypes: dedupeAndSort(baseConfig.shapeTypes.concat(incomingConfig.shapeTypes)),
	bindingTypes: dedupeAndSort(baseConfig.bindingTypes.concat(incomingConfig.bindingTypes)),
})

const isSameSchemaConfig = (a: RoomSchemaConfig, b: RoomSchemaConfig): boolean => {
	return (
		a.shapeTypes.length === b.shapeTypes.length &&
		a.bindingTypes.length === b.bindingTypes.length &&
		a.shapeTypes.every((value, index) => value === b.shapeTypes[index]) &&
		a.bindingTypes.every((value, index) => value === b.bindingTypes[index])
	)
}

// each whiteboard room is hosted in a DurableObject:
// https://developers.cloudflare.com/durable-objects/

// there's only ever one durable object instance per room. it keeps all the room state in memory and
// handles websocket connections. periodically, it persists the room state to the R2 bucket.
export class TldrawDurableObject {
	private r2: R2Bucket
	// the room ID will be missing whilst the room is being initialized
	private roomId: string | null = null
	private roomSchemaConfig: RoomSchemaConfig = { shapeTypes: [], bindingTypes: [] }
	// when we load the room from the R2 bucket, we keep it here. it's a promise so we only ever
	// load it once.
	private roomPromise: Promise<TLSocketRoom<TLRecord, void>> | null = null

	constructor(
		private readonly ctx: DurableObjectState,
		env: Environment
	) {
		this.r2 = env.TLDRAW_BUCKET

		ctx.blockConcurrencyWhile(async () => {
			this.roomId = ((await this.ctx.storage.get('roomId')) ?? null) as string | null
			const schemaConfig =
				((await this.ctx.storage.get(STORAGE_SCHEMA_CONFIG_KEY)) as RoomSchemaConfig) ??
				null
			if (schemaConfig) {
				this.roomSchemaConfig = {
					shapeTypes: dedupeAndSort(schemaConfig.shapeTypes ?? []),
					bindingTypes: dedupeAndSort(schemaConfig.bindingTypes ?? []),
				}
			}
		})
	}

	private readonly router = AutoRouter({
		catch: (e) => {
			console.log(e)
			return error(e)
		},
	})
		// when we get a connection request, we stash the room id if needed and handle the connection
		.get('/connect/:roomId', async (request) => {
			if (!this.roomId) {
				await this.ctx.blockConcurrencyWhile(async () => {
					await this.ctx.storage.put('roomId', request.params.roomId)
					this.roomId = request.params.roomId
				})
			}
			return this.handleConnect(request)
		})

	// `fetch` is the entry point for all requests to the Durable Object
	fetch(request: Request): Response | Promise<Response> {
		return this.router.fetch(request)
	}

	// what happens when someone tries to connect to this room?
	async handleConnect(request: IRequest): Promise<Response> {
		// extract query params from request
		const sessionId = request.query.sessionId as string
		if (!sessionId) return error(400, 'Missing sessionId')
		const incomingSchemaConfig = this.getIncomingSchemaConfig(request)
		await this.ensureSchemaConfig(incomingSchemaConfig)

		// Create the websocket pair for the client
		const { 0: clientWebSocket, 1: serverWebSocket } = new WebSocketPair()
		serverWebSocket.accept()

		// load the room, or retrieve it if it's already loaded
		const room = await this.getRoom()

		// connect the client to the room
		room.handleSocketConnect({ sessionId, socket: serverWebSocket })

		// return the websocket connection to the client
		return new Response(null, { status: 101, webSocket: clientWebSocket })
	}

	private getIncomingSchemaConfig(request: IRequest): RoomSchemaConfig {
		const url = new URL(request.url)
		return {
			shapeTypes: dedupeAndSort(url.searchParams.getAll('shapeType')),
			bindingTypes: dedupeAndSort(url.searchParams.getAll('bindingType')),
		}
	}

	private async ensureSchemaConfig(incomingSchemaConfig: RoomSchemaConfig): Promise<void> {
		const nextConfig = mergeSchemaConfig(this.roomSchemaConfig, incomingSchemaConfig)
		if (isSameSchemaConfig(this.roomSchemaConfig, nextConfig)) return

		this.roomSchemaConfig = nextConfig
		await this.ctx.storage.put(STORAGE_SCHEMA_CONFIG_KEY, this.roomSchemaConfig)

		if (this.roomPromise) {
			const previousRoom = await this.roomPromise
			const snapshot = previousRoom.getCurrentSnapshot()
			previousRoom.close()
			this.roomPromise = Promise.resolve(this.createRoom(snapshot))
		}
	}

	private createRoom(initialSnapshot?: RoomSnapshot): TLSocketRoom<TLRecord, void> {
		return new TLSocketRoom<TLRecord, void>({
			schema: createRoomSchema(this.roomSchemaConfig),
			initialSnapshot,
			onDataChange: () => {
				// and persist whenever the data in the room changes
				this.schedulePersistToR2()
			},
		})
	}

	getRoom() {
		const roomId = this.roomId
		if (!roomId) throw new Error('Missing roomId')

		if (!this.roomPromise) {
			this.roomPromise = (async () => {
				// fetch the room from R2
				const roomFromBucket = await this.r2.get(`rooms/${roomId}`)

				// if it doesn't exist, we'll just create a new empty room
				const initialSnapshot = roomFromBucket
					? ((await roomFromBucket.json()) as RoomSnapshot)
					: undefined

				// create a new TLSocketRoom. This handles all the sync protocol & websocket connections.
				// it's up to us to persist the room state to R2 when needed though.
				return this.createRoom(initialSnapshot)
			})()
		}

		return this.roomPromise
	}

	// we throttle persistance so it only happens every 10 seconds
	schedulePersistToR2 = throttle(async () => {
		if (!this.roomPromise || !this.roomId) return
		const room = await this.getRoom()

		// convert the room to JSON and upload it to R2
		const snapshot = JSON.stringify(room.getCurrentSnapshot())
		await this.r2.put(`rooms/${this.roomId}`, snapshot)
	}, 10_000)
}
