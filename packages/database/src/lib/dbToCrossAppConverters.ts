import {
  CrossAppNodeSchema,
  CrossAppRelationTypeSchema,
  CrossAppRelationTripleSchema,
  CrossAppRelation,
} from "../crossAppContracts";
import { Tables, Json } from "../dbTypes";
import type { DGSupabaseClient } from "./client";
import { ridToSpaceUriAndLocalId, spaceUriAndLocalIdToRid, isRid } from "./rid";

type Concept = Tables<"Concept">;

const getConceptMap = async (
  client: DGSupabaseClient,
  conceptIds: number[],
  spaceMap: Record<number, string>,
): Promise<Record<number, string>> => {
  const request = await client
    .from("my_concepts")
    .select("id, space_id, source_local_id")
    .in("id", conceptIds)
    .not("source_local_id", "is", null);
  if (request.error) throw request.error;
  return Object.fromEntries(
    (request.data || [])
      .map(({ id, source_local_id, space_id }) => {
        const spaceUri: string | undefined = spaceMap[space_id ?? 0];
        return [
          id!,
          spaceUri !== undefined
            ? spaceUriAndLocalIdToRid(spaceUri, source_local_id)
            : undefined,
        ];
      })
      .filter(([, rid]) => rid !== undefined) as [number, string][],
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

export const dbNodeSchemaToCrossApp = (
  schema: Concept,
  spaceMap: Record<number, string>,
  accountMap: Record<number, string>,
): CrossAppNodeSchema => {
  const { template, template_content, format, ...other } =
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
    label: schema.name,
    metadata: other,
    template: template_content as string | undefined,
    templateTitle: template as string | undefined,
    format: format as string | undefined,
    authorId,
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
  return schemas.map((r) => dbNodeSchemaToCrossApp(r, spaceMap, accountMap));
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
