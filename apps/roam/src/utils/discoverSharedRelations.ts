import type { DGSupabaseClient } from "@repo/database/lib/client";
import type {
  CrossAppRelation,
  CrossAppRelationTypeSchema,
  CrossAppRelationTripleSchema,
  CrossAppNodeSchema,
} from "@repo/database/crossAppContracts";
import {
  getAccountMap,
  getSpaceMap,
  dbRelationTripleSchemasToCrossApp,
  dbRelationsToCrossApp,
  dbRelationTypeSchemasToCrossApp,
  dbNodeSchemasToCrossApp,
} from "@repo/database/lib/dbToCrossAppConverters";
import { Tables } from "@repo/database/dbTypes";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import { getReifiedRelations } from "./createReifiedBlock";

type Concept = Tables<"Concept">;

export const discoverSharedRelations = async ({
  client,
  spaceId,
}: {
  client: DGSupabaseClient;
  spaceId: number;
}): Promise<{
  relations: CrossAppRelation[];
  relTripleSchemas: CrossAppRelationTripleSchema[];
  relTypeSchemas: CrossAppRelationTypeSchema[];
  nodeSchemas: CrossAppNodeSchema[];
  idToRid: Record<number, string>;
}> => {
  const response = {
    relations: [] as CrossAppRelation[],
    relTripleSchemas: [] as CrossAppRelationTripleSchema[],
    relTypeSchemas: [] as CrossAppRelationTypeSchema[],
    nodeSchemas: [] as CrossAppNodeSchema[],
    idToRid: {},
  };
  // TODO: paginate
  const { data: dbAllImportableRelations, error: relError } = await client
    .from("my_concepts")
    .select("*, concepts_of_relation!inner(id, space_id, source_local_id)")
    .neq("space_id", spaceId)
    .eq("is_schema", false)
    .gt("arity", 0);

  if (relError || !dbAllImportableRelations) {
    throw relError;
  }
  if (dbAllImportableRelations.length === 0) return response;
  const relatedNodeInfo = dbAllImportableRelations
    .map((r) => r.concepts_of_relation)
    .flat();
  const spaceIds = new Set(relatedNodeInfo.map(({ space_id }) => space_id!));
  const spaceMap = await getSpaceMap(client, [...spaceIds]);
  const toRid = (spaceId: number, localId: string) =>
    spaceId in spaceMap
      ? spaceUriAndLocalIdToRid(spaceMap[spaceId], localId)
      : undefined;
  const idToRid: Record<number, string> = Object.fromEntries(
    relatedNodeInfo
      .map(
        ({ id, space_id, source_local_id }): [number, string] | undefined => {
          if (id === null || space_id === null || source_local_id === null)
            return;
          const rid = toRid(space_id, source_local_id);
          if (rid === undefined) return;
          return [id, rid];
        },
      )
      .filter((x) => x !== undefined),
  );

  // We want those relations whose source/destinations are either already imported,
  // or somehow connected by Rid to local nodes.
  const refToLocalIds = new Set(
    relatedNodeInfo
      .filter(({ space_id }) => space_id === spaceId)
      .map(({ id }) => id),
  );
  const importedRelationsRids = new Set(
    (await getReifiedRelations())
      .map((r) => r.importedFromRid)
      .filter((rid) => rid !== undefined),
  );
  const dbRelations = dbAllImportableRelations.filter((r) => {
    const references = (r.reference_content || {}) as Record<string, number>;
    const sourceId = references["source"];
    const destinationId = references["destination"];
    if (!sourceId || !destinationId) return false;
    return (
      (refToLocalIds.has(sourceId) ||
        importedRelationsRids.has(idToRid[sourceId] ?? "")) &&
      (refToLocalIds.has(destinationId) ||
        importedRelationsRids.has(idToRid[destinationId] ?? ""))
    );
  });
  const tripleSchemaIds = new Set(
    dbRelations.map((r) => r.schema_id).filter((r) => r !== null),
  );
  if (tripleSchemaIds.size === 0) return response;
  const { data: dbRelTripleSchemas, error: trsError } = await client
    .from("my_concepts")
    .select()
    .in("id", [...tripleSchemaIds]);
  if (trsError || !dbRelTripleSchemas) {
    throw trsError;
  }
  const relationTypeSchemaIds = new Set<number>(
    dbRelTripleSchemas
      .map(
        (r) =>
          (typeof r.reference_content === "object"
            ? (r.reference_content as Record<string, number>)
            : {})["relation_type"],
      )
      .filter((id) => id !== undefined),
  );
  let dbRelTypeSchemas: Concept[] = [];
  if (relationTypeSchemaIds.size > 0) {
    const { data, error: tysError } = await client
      .from("my_concepts")
      .select()
      .in("id", [...relationTypeSchemaIds]);
    if (tysError || !data) {
      throw tysError;
    }
    dbRelTypeSchemas = data as Concept[];
  }
  const nodeTypeSchemaIds = new Set<number>(
    dbRelTripleSchemas
      .map((r) => {
        const refs = (r.reference_content || {}) as Record<string, number>;
        return [refs.source, refs.destination];
      })
      .flat()
      .filter((id) => id !== undefined),
  );
  const { data: dbNodeTypeSchemas, error: nsError } = await client
    .from("my_concepts")
    .select()
    .in("id", [...relationTypeSchemaIds]);
  if (nsError || !nodeTypeSchemaIds) {
    throw nsError;
  }
  const authorIds = [
    ...dbRelations,
    ...dbRelTripleSchemas,
    ...dbRelTypeSchemas,
    ...dbNodeTypeSchemas,
  ]
    .map((r) => r.author_id)
    .filter((id) => id !== null);
  const accountMap = await getAccountMap(client, [...new Set(authorIds)]);
  const relTypeSchemas = await dbRelationTypeSchemasToCrossApp({
    client,
    schemas: dbRelTypeSchemas,
    spaceMap,
    accountMap,
  });
  const relTripleSchemas = await dbRelationTripleSchemasToCrossApp({
    client,
    schemas: dbRelTripleSchemas as Concept[],
    spaceMap,
    accountMap,
  });
  const relations = await dbRelationsToCrossApp({
    client,
    relations: dbRelations as Concept[],
    accountMap,
    spaceId,
    spaceMap,
  });
  const nodeSchemas = await dbNodeSchemasToCrossApp({
    client,
    schemas: dbNodeTypeSchemas as Concept[],
    spaceMap,
    accountMap,
  });
  return {
    relations,
    relTripleSchemas,
    relTypeSchemas,
    nodeSchemas,
    idToRid,
  };
};
