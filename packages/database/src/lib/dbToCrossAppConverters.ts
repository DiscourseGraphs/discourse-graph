import {
  CrossAppNode,
  CrossAppNodeSchema,
  CrossAppRelationTypeSchema,
  CrossAppRelationTripleSchema,
  CrossAppRelation,
} from "../crossAppContracts";
import { Tables, Json } from "../dbTypes";
import { resolveSchemaFormat } from "@repo/utils/resolveSchemaFormat";
import type { DGSupabaseClient } from "./client";
import { extractContentFromTitle } from "./extractContentFromTitle";
import { ridToSpaceUriAndLocalId, spaceUriAndLocalIdToRid, isRid } from "./rid";

type Concept = Tables<"Concept">;

export type DbNodeConcept = Pick<
  Tables<"my_concepts">,
  | "is_schema"
  | "last_modified"
  | "schema_id"
  | "source_local_id"
  | "space_id"
  | "reference_content"
> & {
  core_title: string | null;
  concepts_of_relation: {
    id: number | null;
    space_id: number | null;
    source_local_id: string | null;
  }[];
};
export type DbNodeContent = Pick<
  Tables<"my_contents">,
  | "author_id"
  | "created"
  | "last_modified"
  | "metadata"
  | "source_local_id"
  | "space_id"
  | "text"
  | "variant"
>;
type DbNodeContentSummary = Pick<
  Tables<"my_contents">,
  "last_modified" | "source_local_id" | "space_id"
>;

export type DbNodeRows = {
  nodes: DbNodeConcept[];
  directContents: DbNodeContent[];
  fullContentSummaries: DbNodeContentSummary[];
};

export type DbNodeRow = {
  concept: DbNodeConcept;
  direct: DbNodeContent | undefined;
  fullLastModified: string | null;
};

export type ResolvedDbNode = {
  rid: string;
  localId: string;
  schemaId: number;
  spaceId: number;
  direct: DbNodeContent;
  title: string;
  created: string | null;
  modifiedAt: string;
  slots?: Record<string, string>;
};

const getConceptMap = async (
  client: DGSupabaseClient,
  conceptIds: number[],
  spaceMap: Record<number, string>,
): Promise<Record<number, string>> => {
  if (conceptIds.length === 0) return {};
  const request = await client
    .from("my_concepts")
    .select("id, space_id, source_local_id, is_schema, is_relation")
    .in("id", conceptIds)
    .not("source_local_id", "is", null);
  if (request.error) throw request.error;
  return Object.fromEntries(
    (request.data || [])
      // eslint-disable-next-line @typescript-eslint/naming-convention
      .map(({ id, source_local_id, space_id, is_schema, is_relation }) => {
        const spaceUri: string | undefined = spaceMap[space_id ?? 0];
        return [
          id!,
          spaceUri !== undefined
            ? spaceUriAndLocalIdToRid(
                spaceUri,
                source_local_id,
                is_schema ? "schema" : is_relation ? "relation" : "note",
              )
            : undefined,
        ];
      })
      .filter(([, rid]) => rid !== undefined) as [number, string][],
  );
};

const getSchemaFormatMap = async (
  client: DGSupabaseClient,
  schemaIds: number[],
): Promise<Record<number, string>> => {
  if (schemaIds.length === 0) return {};
  const { data, error } = await client
    .from("my_concepts")
    .select(
      "id, format:literal_content->>format, sourceDataFormat:literal_content->source_data->>format",
    )
    .in("id", schemaIds);
  if (error) throw error;
  return Object.fromEntries(
    data.flatMap(({ id, format, sourceDataFormat }) =>
      id === null
        ? []
        : [[id, resolveSchemaFormat({ format, sourceDataFormat })]],
    ),
  );
};

export const getAccountMap = async (
  client: DGSupabaseClient,
  accountIds: number[],
): Promise<Record<number, string>> => {
  const request = await client
    .from("my_accounts")
    .select("id,account_local_id")
    .in("id", accountIds);
  if (request.error) throw request.error;
  return Object.fromEntries(
    (request.data || []).map(({ id, account_local_id }) => [
      id!,
      account_local_id!,
    ]),
  );
};

export const getSpaceMap = async (
  client: DGSupabaseClient,
  spaceIds?: number[],
): Promise<Record<number, string>> => {
  let query = client.from("my_spaces").select("id, url");
  if (spaceIds !== undefined) query = query.in("id", [...spaceIds]);

  const { data, error } = await query;
  if (error) throw error;
  if (!data) throw new Error("Missing spaces");
  return Object.fromEntries(data.map(({ id, url }) => [id!, url!]));
};

const asSimpleLocalId = (
  rid: string | undefined,
  spaceUrl: string | undefined,
  optional?: boolean,
): string | undefined => {
  if (rid === undefined) return undefined;
  if (!isRid(rid)) return rid;
  const { spaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(rid);
  if (spaceUrl === spaceUri) return sourceLocalId;
  if (optional !== true) throw new Error("Unexpected spaceUri");
  return rid;
};

export const dbNodeSchemaToCrossApp = ({
  schema,
  spaceMap,
  accountMap,
  schemaMap,
}: {
  schema: Concept;
  spaceMap: Record<number, string>;
  accountMap: Record<number, string>;
  schemaMap: Record<number, string>;
}): CrossAppNodeSchema => {
  const referenceContent = (schema.reference_content ?? {}) as Record<
    string,
    number
  >;
  const { template, template_content, roles, ...other } =
    schema.literal_content as Record<string, Json>;
  const authorId = accountMap[schema.author_id || 0];
  if (authorId === undefined) throw new Error("Missing author");
  const spaceUrl = spaceMap[schema.space_id];
  if (spaceUrl === undefined) throw new Error("Missing space");
  const rid = spaceUriAndLocalIdToRid(
    spaceUrl,
    schema.source_local_id!,
    "schema",
  );
  const slotDefinitions = Object.fromEntries(
    ((roles as string[] | undefined) ?? []).map((r) => [
      r,
      asSimpleLocalId(schemaMap[referenceContent[r] ?? 0], spaceUrl),
    ]),
  );
  return {
    rid,
    localId: schema.source_local_id!,
    createdAt: new Date(schema.created + "Z"),
    modifiedAt: new Date(schema.last_modified + "Z"),
    label: schema.name,
    metadata: other,
    template: template_content as string | undefined,
    templateTitle: template as string | undefined,
    authorId,
    slotDefinitions,
  };
};

export const dbNodeSchemasToCrossApp = async ({
  client,
  schemas,
  spaceMap,
  accountMap,
}: {
  client: DGSupabaseClient;
  schemas: Concept[];
  spaceMap?: Record<number, string>;
  accountMap?: Record<number, string>;
}): Promise<CrossAppNodeSchema[]> => {
  if (spaceMap === undefined) spaceMap = await getSpaceMap(client);
  if (accountMap === undefined) {
    const authorIds = new Set<number>(
      schemas.map((r) => r.author_id).filter((id) => typeof id === "number"),
    );
    accountMap = await getAccountMap(client, [...authorIds]);
  }
  const referredSchemaIds = schemas.flatMap((schema) => schema.refs);
  const schemaMap = await getConceptMap(client, referredSchemaIds, spaceMap);
  return schemas.map((schema) =>
    dbNodeSchemaToCrossApp({ schema, spaceMap, accountMap, schemaMap }),
  );
};

const getResourceKey = (row: {
  space_id: number | null;
  source_local_id: string | null;
}): string => `${row.space_id}:${row.source_local_id}`;

const normalizeUtcTimestamp = (timestamp: string | null): string | null => {
  if (!timestamp) return null;
  const date = new Date(`${timestamp}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const getLatestTimestamp = (timestamps: (string | null)[]): string | null => {
  const validTimestamps = timestamps
    .map(normalizeUtcTimestamp)
    .filter((timestamp): timestamp is string => typeof timestamp === "string");
  if (validTimestamps.length === 0) return null;
  return validTimestamps.reduce((latest, timestamp) =>
    timestamp > latest ? timestamp : latest,
  );
};

export const groupDbNodeRows = ({
  nodes,
  directContents,
  fullContentSummaries,
}: DbNodeRows): DbNodeRow[] => {
  const directByResource = new Map<string, DbNodeContent>();
  directContents.forEach((content) => {
    if (
      typeof content.space_id !== "number" ||
      typeof content.source_local_id !== "string" ||
      content.variant !== "direct"
    )
      return;
    directByResource.set(getResourceKey(content), content);
  });

  const fullModifiedByResource = new Map<string, string | null>();
  fullContentSummaries.forEach((summary) => {
    if (
      typeof summary.space_id !== "number" ||
      typeof summary.source_local_id !== "string"
    )
      return;
    fullModifiedByResource.set(getResourceKey(summary), summary.last_modified);
  });

  return nodes.map((concept) => ({
    concept,
    direct: directByResource.get(getResourceKey(concept)),
    fullLastModified:
      fullModifiedByResource.get(getResourceKey(concept)) ?? null,
  }));
};

export const resolveDbNode = ({
  row: { concept, direct, fullLastModified },
  spaceMap,
}: {
  row: DbNodeRow;
  spaceMap: Record<number, string>;
}): ResolvedDbNode => {
  if (concept.is_schema !== false) throw new Error("Not a node instance");
  if (concept.schema_id === null) throw new Error("Missing node type");
  if (typeof concept.source_local_id !== "string")
    throw new Error("Missing local id");
  if (typeof concept.space_id !== "number") throw new Error("Missing space");
  const spaceUrl = spaceMap[concept.space_id];
  if (spaceUrl === undefined) throw new Error("Missing space");
  if (typeof direct?.text !== "string")
    throw new Error("Missing direct content");

  const created = normalizeUtcTimestamp(direct.created);
  const modifiedAt =
    getLatestTimestamp([
      concept.last_modified,
      direct.last_modified,
      fullLastModified,
    ]) ?? created;
  if (!modifiedAt) throw new Error("Missing modified date");

  const rid = spaceUriAndLocalIdToRid(
    spaceUrl,
    concept.source_local_id,
    "note",
  );

  const nodeRidById = Object.fromEntries(
    concept.concepts_of_relation
      .filter((c) => c.id !== null)
      .map((c) => {
        if (c.space_id === concept.space_id)
          return [c.id, c.source_local_id ?? undefined];
        const slotSpaceUrl = spaceMap[c.space_id || 0];
        if (!slotSpaceUrl || !c.source_local_id || !c.id)
          return [c.id, undefined];
        return [
          c.id,
          // To be reviewed if we have relations of relations
          spaceUriAndLocalIdToRid(slotSpaceUrl, c.source_local_id, "note"),
        ];
      }) as [number, string | undefined][],
  );
  const referenceContent = (concept.reference_content ?? {}) as Record<
    string,
    number
  >;
  const slots = Object.fromEntries(
    Object.entries(referenceContent ?? {})
      .map(([k, v]) => [k, nodeRidById[v]])
      .filter(([, v]) => v !== undefined) as [string, string][],
  );

  return {
    rid,
    localId: concept.source_local_id,
    schemaId: concept.schema_id,
    spaceId: concept.space_id,
    direct,
    title: direct.text,
    created,
    modifiedAt,
    slots: Object.keys(slots).length > 0 ? slots : undefined,
  };
};

export const dbNodeToCrossApp = ({
  row,
  spaceMap,
  accountMap,
  schemaMap,
  formatMap,
}: {
  row: DbNodeRow;
  spaceMap: Record<number, string>;
  accountMap: Record<number, string>;
  schemaMap: Record<number, string>;
  formatMap: Record<number, string>;
}): CrossAppNode => {
  const {
    rid,
    localId,
    schemaId,
    spaceId,
    direct,
    title,
    created,
    modifiedAt,
    slots,
  } = resolveDbNode({ row, spaceMap });
  if (created === null) throw new Error("Missing created date");
  const authorId = accountMap[direct.author_id || 0];
  if (authorId === undefined) throw new Error("Missing author");
  const coreTitle =
    row.concept.core_title ??
    extractContentFromTitle(formatMap[schemaId] ?? "", title);
  const nodeType = asSimpleLocalId(schemaMap[schemaId], spaceMap[spaceId]);
  if (nodeType === undefined) throw new Error("Missing node type");
  return {
    rid,
    localId,
    createdAt: new Date(created),
    modifiedAt: new Date(modifiedAt),
    authorId,
    nodeType,
    coreTitle,
    content: { direct: { value: title } },
    slots,
  };
};

export const dbNodesToCrossApp = async ({
  client,
  nodes,
  directContents,
  fullContentSummaries,
  spaceMap,
}: DbNodeRows & {
  client: DGSupabaseClient;
  spaceMap: Record<number, string>;
}): Promise<CrossAppNode[]> => {
  const authorIds = new Set<number>(
    directContents
      .map((c) => c.author_id)
      .filter((id) => typeof id === "number"),
  );
  const getSchemaIds = (concepts: DbNodeConcept[]): number[] => [
    ...new Set<number>(
      concepts.map((c) => c.schema_id).filter((id) => typeof id === "number"),
    ),
  ];
  const [accountMap, schemaMap, formatMap] = await Promise.all([
    getAccountMap(client, [...authorIds]),
    getConceptMap(client, getSchemaIds(nodes), spaceMap),
    getSchemaFormatMap(
      client,
      getSchemaIds(nodes.filter((n) => n.core_title === null)),
    ),
  ]);
  return groupDbNodeRows({
    nodes,
    directContents,
    fullContentSummaries,
  }).flatMap((row) => {
    try {
      return [
        dbNodeToCrossApp({ row, spaceMap, accountMap, schemaMap, formatMap }),
      ];
    } catch (error) {
      console.warn(
        `Skipped node ${row.concept.source_local_id} of space ${row.concept.space_id}:`,
        error,
      );
      return [];
    }
  });
};

export const dbRelationTypeSchemaToCrossApp = (
  schema: Concept,
  spaceMap: Record<number, string>,
  accountMap: Record<number, string>,
): CrossAppRelationTypeSchema => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { roles, label, complement, ...other } =
    schema.literal_content as Record<string, Json>;
  const authorId = accountMap[schema.author_id || 0];
  if (authorId === undefined) throw new Error("Missing author");
  const spaceUrl = spaceMap[schema.space_id];
  if (spaceUrl === undefined) throw new Error("Missing space");
  const rid = spaceUriAndLocalIdToRid(
    spaceUrl,
    schema.source_local_id!,
    "schema",
  );
  return {
    rid,
    localId: schema.source_local_id!,
    createdAt: new Date(schema.created + "Z"),
    modifiedAt: new Date(schema.last_modified + "Z"),
    metadata: other,
    label: label as string,
    complement: complement as string,
    authorId,
  };
};

export const dbRelationTypeSchemasToCrossApp = async ({
  client,
  schemas,
  spaceMap,
  accountMap,
}: {
  client: DGSupabaseClient;
  schemas: Concept[];
  spaceMap?: Record<number, string>;
  accountMap?: Record<number, string>;
}): Promise<CrossAppRelationTypeSchema[]> => {
  if (spaceMap === undefined) spaceMap = await getSpaceMap(client);
  if (accountMap === undefined) {
    const authorIds = new Set<number>(
      schemas.map((r) => r.author_id).filter((id) => typeof id === "number"),
    );
    accountMap = await getAccountMap(client, [...authorIds]);
  }

  return schemas.map((r) =>
    dbRelationTypeSchemaToCrossApp(r, spaceMap, accountMap),
  );
};

export const dbRelationTripleSchemaToCrossApp = ({
  schema,
  spaceMap,
  accountMap,
  conceptMap,
}: {
  schema: Concept;
  spaceMap: Record<number, string>;
  accountMap: Record<number, string>;
  conceptMap: Record<number, string>;
}): CrossAppRelationTripleSchema => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { roles, label, complement, ...other } =
    schema.literal_content as Record<string, Json>;
  const authorId = accountMap[schema.author_id || 0];
  if (authorId === undefined) throw new Error("Missing author");
  const references = (schema.reference_content ?? {}) as Record<string, number>;
  const spaceUrl = spaceMap[schema.space_id];
  if (spaceUrl === undefined) throw new Error("Missing space");
  const rid = spaceUriAndLocalIdToRid(
    spaceUrl,
    schema.source_local_id!,
    "schema",
  );
  const relation = asSimpleLocalId(
    conceptMap[references["relation_type"] ?? 0],
    spaceUrl,
  );
  const sourceType = asSimpleLocalId(
    conceptMap[references["source"] ?? 0],
    spaceUrl,
  );
  const destinationType = asSimpleLocalId(
    conceptMap[references["destination"] ?? 0],
    spaceUrl,
  );
  if (sourceType === undefined) throw new Error("Missing source type");
  if (destinationType === undefined)
    throw new Error("Missing destination type");
  const base = {
    rid,
    localId: schema.source_local_id!,
    createdAt: new Date(schema.created + "Z"),
    modifiedAt: new Date(schema.last_modified + "Z"),
    metadata: other,
    authorId,
    sourceType,
    destinationType,
  };
  if (relation) {
    return {
      ...base,
      relation,
    };
  } else {
    if (typeof label !== "string" || typeof complement !== "string")
      throw new Error("Missing either relation_type or relation_type data");
    return {
      ...base,
      label,
      complement,
    };
  }
};

export const dbRelationTripleSchemasToCrossApp = async ({
  client,
  schemas,
  spaceMap,
  accountMap,
  conceptMap,
}: {
  client: DGSupabaseClient;
  schemas: Concept[];
  spaceMap?: Record<number, string>;
  accountMap?: Record<number, string>;
  conceptMap?: Record<number, string>;
}): Promise<CrossAppRelationTripleSchema[]> => {
  if (spaceMap === undefined) spaceMap = await getSpaceMap(client);
  if (accountMap === undefined) {
    const authorIds = new Set<number>(
      schemas.map((r) => r.author_id).filter((id) => typeof id === "number"),
    );
    accountMap = await getAccountMap(client, [...authorIds]);
  }
  if (conceptMap === undefined) {
    const schemaIds = schemas
      .map((r) => {
        const refs = (r.reference_content ?? {}) as Record<
          string,
          number | number[]
        >;
        return [
          refs["source"] ?? [],
          refs["destination"] ?? [],
          refs["relation_type"] ?? [],
        ];
      })
      .flat(2);
    conceptMap = await getConceptMap(client, [...new Set(schemaIds)], spaceMap);
  }

  return schemas.map((schema) =>
    dbRelationTripleSchemaToCrossApp({
      schema,
      spaceMap,
      accountMap,
      conceptMap,
    }),
  );
};

export const dbRelationToCrossApp = ({
  relation,
  spaceMap,
  accountMap,
  conceptMap,
}: {
  relation: Concept;
  spaceMap: Record<number, string>;
  accountMap: Record<number, string>;
  conceptMap: Record<number, string>;
}): CrossAppRelation => {
  const authorId = accountMap[relation.author_id || 0];
  if (authorId === undefined) throw new Error("Missing author");
  const references = (relation.reference_content ?? {}) as Record<
    string,
    number
  >;
  const spaceUrl = spaceMap[relation.space_id];
  if (spaceUrl === undefined) throw new Error("Missing space");
  const rid = spaceUriAndLocalIdToRid(
    spaceUrl,
    relation.source_local_id!,
    "relation",
  );
  const relationType = asSimpleLocalId(
    conceptMap[relation.schema_id || 0],
    spaceUrl,
  );
  if (relationType === undefined) throw new Error("Missing relationType");
  const source = asSimpleLocalId(
    conceptMap[references["source"] || 0],
    spaceUrl,
    true,
  );
  if (source === undefined) throw new Error("Missing source");
  const destination = asSimpleLocalId(
    conceptMap[references["destination"] || 0],
    spaceUrl,
    true,
  );
  if (destination === undefined) throw new Error("Missing destination");

  return {
    rid,
    localId: relation.source_local_id!,
    authorId,
    createdAt: new Date(relation.created + "Z"),
    modifiedAt: new Date(relation.last_modified + "Z"),
    source,
    destination,
    relationType,
  };
};

export const dbRelationsToCrossApp = async ({
  client,
  relations,
  accountMap,
  conceptMap,
  spaceMap,
}: {
  client: DGSupabaseClient;
  relations: Concept[];
  accountMap?: Record<number, string>;
  conceptMap?: Record<number, string>;
  spaceMap?: Record<number, string>;
}): Promise<CrossAppRelation[]> => {
  if (accountMap === undefined) {
    const authorIds = new Set<number>(
      relations.map((r) => r.author_id).filter((id) => typeof id === "number"),
    );
    accountMap = await getAccountMap(client, [...authorIds]);
  }
  if (spaceMap === undefined) {
    spaceMap = await getSpaceMap(client);
  }
  if (conceptMap === undefined) {
    const nodeIds = relations
      .map((r) => {
        const refs = (r.reference_content ?? {}) as Record<
          string,
          number | number[]
        >;
        return [refs["source"] ?? [], refs["destination"] ?? []];
      })
      .flat(2);
    const schemaIds = relations
      .map((r) => r.schema_id)
      .filter((id) => id !== null);
    conceptMap = await getConceptMap(
      client,
      [...new Set([...schemaIds, ...nodeIds])],
      spaceMap,
    );
  }
  return relations.map((relation) =>
    dbRelationToCrossApp({ relation, spaceMap, accountMap, conceptMap }),
  );
};
