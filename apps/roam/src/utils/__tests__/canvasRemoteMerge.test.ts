import { describe, expect, it } from "vitest";
import {
  BaseBoxShapeUtil,
  DocumentRecordType,
  PageRecordType,
  IndexKey,
  T,
  TLBaseShape,
  TLDOCUMENT_ID,
  TLStore,
  TLStoreSnapshot,
  createMigrationIds,
  createMigrationSequence,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  loadSnapshot,
} from "tldraw";
import type { SerializedStore } from "@tldraw/store";
import type { TLRecord } from "@tldraw/tlschema";
import {
  calculateDiff,
  mergeRemoteCanvasState,
} from "~/components/canvas/canvasRemoteMerge";

// Mirrors the production situation that produced the dg-frame blank-page bug:
// persisted canvas stores can hold shapes whose type is a legacy node uid
// (e.g. "lxCvhQ034") that a store-level migration retypes on load, but the
// live schema itself does not register. `loadSnapshot` migrates; a raw
// `applyDiff` of the persisted store does not, and throws a ValidationError.
const LEGACY_NODE_TYPE = "lxCvhQ034test";
const MIGRATED_NODE_TYPE = "discourse-node-test";

type TestNodeShape = TLBaseShape<
  typeof MIGRATED_NODE_TYPE,
  { w: number; h: number; nodeTypeId: string }
>;

class TestDiscourseNodeUtil extends BaseBoxShapeUtil<TestNodeShape> {
  static override type = MIGRATED_NODE_TYPE;
  static override props = {
    w: T.number,
    h: T.number,
    nodeTypeId: T.string,
  };
  override getDefaultProps() {
    return { w: 100, h: 50, nodeTypeId: "" };
  }
  override component() {
    return null;
  }
  override indicator() {
    return null;
  }
}

const versions = createMigrationIds("com.test.discourse-node", {
  MigrateNodeTypeToDiscourseNode: 1,
});

// Same shape as the real MigrateNodeTypeToDiscourseNode migration in
// discourseRelationMigrations.ts: retype a node-uid-typed shape to the
// registered discourse-node type, keeping the uid in props.
const testMigrations = createMigrationSequence({
  sequenceId: "com.test.discourse-node",
  retroactive: true,
  sequence: [
    {
      id: versions.MigrateNodeTypeToDiscourseNode,
      scope: "record",
      filter: (r) =>
        r.typeName === "shape" &&
        (r as { type?: string }).type === LEGACY_NODE_TYPE,
      up: (shape) => {
        const s = shape as unknown as {
          type: string;
          props: Record<string, unknown>;
        };
        s.props.nodeTypeId = s.type;
        s.type = MIGRATED_NODE_TYPE;
      },
    },
  ],
});

const PAGE_ID = PageRecordType.createId("page");
const LEGACY_SHAPE_ID = "shape:legacy1";

const makeLegacyShape = (
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> => ({
  id: LEGACY_SHAPE_ID,
  typeName: "shape",
  type: LEGACY_NODE_TYPE,
  x: 0,
  y: 0,
  rotation: 0,
  index: "a2",
  parentId: PAGE_ID,
  isLocked: false,
  opacity: 1,
  meta: {},
  props: { w: 100, h: 50 },
  ...overrides,
});

// A persisted snapshot the way Roam block props hold it: records saved before
// the discourse migration sequence existed (schema without that sequence), so
// the legacy-typed shape is still present raw.
const makePersistedSnapshot = (
  extraRecords: Record<string, unknown>[] = [],
): TLStoreSnapshot => {
  const scratch = createTLStore({
    shapeUtils: defaultShapeUtils,
    bindingUtils: defaultBindingUtils,
  });
  scratch.put([
    DocumentRecordType.create({ id: TLDOCUMENT_ID }),
    PageRecordType.create({
      id: PAGE_ID,
      name: "Page 1",
      index: "a1" as IndexKey,
    }),
  ]);
  const snapshot = scratch.getStoreSnapshot();
  const store = { ...snapshot.store } as Record<string, unknown>;
  for (const record of [makeLegacyShape(), ...extraRecords]) {
    store[record.id as string] = record;
  }
  return {
    store: store as TLStoreSnapshot["store"],
    schema: snapshot.schema,
  };
};

const makeLiveStore = (): TLStore =>
  createTLStore({
    shapeUtils: [...defaultShapeUtils, TestDiscourseNodeUtil],
    bindingUtils: defaultBindingUtils,
    migrations: [testMigrations],
  });

const mountLiveStore = (snapshot: TLStoreSnapshot): TLStore => {
  const store = makeLiveStore();
  loadSnapshot(store, snapshot);
  return store;
};

const getShape = (store: TLStore, id: string) =>
  store.get(id as Parameters<TLStore["get"]>[0]) as unknown as
    | { type: string; x: number; props: Record<string, unknown> }
    | undefined;

describe("mergeRemoteCanvasState", () => {
  it("mount path migrates the legacy-typed shape (sanity check)", () => {
    const store = mountLiveStore(makePersistedSnapshot());
    const shape = getShape(store, LEGACY_SHAPE_ID);
    expect(shape?.type).toBe(MIGRATED_NODE_TYPE);
    expect(shape?.props.nodeTypeId).toBe(LEGACY_NODE_TYPE);
  });

  it("documents the original bug: raw applyDiff of the unmigrated store throws", () => {
    const persisted = makePersistedSnapshot();
    const store = mountLiveStore(persisted);
    expect(() =>
      store.mergeRemoteChanges(() => {
        const diff = calculateDiff(persisted.store, store.getSnapshot().store);
        store.applyDiff(diff);
      }),
    ).toThrow();
  });

  it("applies an unmigrated remote snapshot by migrating it first", () => {
    const persisted = makePersistedSnapshot();
    const store = mountLiveStore(persisted);
    const result = mergeRemoteCanvasState({ store, remoteTldraw: persisted });
    expect(result).toEqual({ type: "applied", droppedRecordIds: [] });
    const shape = getShape(store, LEGACY_SHAPE_ID);
    expect(shape?.type).toBe(MIGRATED_NODE_TYPE);
    expect(shape?.props.nodeTypeId).toBe(LEGACY_NODE_TYPE);
  });

  it("propagates adds, moves, and removals from the remote snapshot", () => {
    const store = mountLiveStore(makePersistedSnapshot());

    const secondShape = makeLegacyShape({ id: "shape:legacy2", index: "a3" });
    const withChanges = makePersistedSnapshot([secondShape]);
    (withChanges.store as unknown as Record<string, Record<string, unknown>>)[
      LEGACY_SHAPE_ID
    ] = makeLegacyShape({ x: 250 });

    const result = mergeRemoteCanvasState({
      store,
      remoteTldraw: withChanges,
    });
    expect(result.type).toBe("applied");
    expect(getShape(store, LEGACY_SHAPE_ID)?.x).toBe(250);
    expect(getShape(store, "shape:legacy2")?.type).toBe(MIGRATED_NODE_TYPE);

    const withRemoval = makePersistedSnapshot();
    const removalResult = mergeRemoteCanvasState({
      store,
      remoteTldraw: withRemoval,
    });
    expect(removalResult.type).toBe("applied");
    expect(getShape(store, "shape:legacy2")).toBeUndefined();
  });

  it("drops records the schema still rejects instead of failing the merge", () => {
    const store = mountLiveStore(makePersistedSnapshot());

    const hopeless = makeLegacyShape({
      id: "shape:unknown1",
      type: "no-such-type-anywhere",
      index: "a4",
    });
    const moved = makeLegacyShape({ x: 99 });
    const snapshot = makePersistedSnapshot([hopeless]);
    (snapshot.store as unknown as Record<string, Record<string, unknown>>)[
      LEGACY_SHAPE_ID
    ] = moved;

    const result = mergeRemoteCanvasState({ store, remoteTldraw: snapshot });
    expect(result).toEqual({
      type: "applied",
      droppedRecordIds: ["shape:unknown1"],
    });
    // The good change still landed; the bad record never entered the store.
    expect(getShape(store, LEGACY_SHAPE_ID)?.x).toBe(99);
    expect(getShape(store, "shape:unknown1")).toBeUndefined();
  });

  it("returns a result instead of throwing for bare legacy-format data", () => {
    const store = mountLiveStore(makePersistedSnapshot());
    // Old code did `newState.store` on this and crashed with a TypeError.
    const bareLegacyStore = {} as SerializedStore<TLRecord>;
    expect(() =>
      mergeRemoteCanvasState({ store, remoteTldraw: bareLegacyStore }),
    ).not.toThrow();
  });
});
