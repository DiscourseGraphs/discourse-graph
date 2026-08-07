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
import { getImportedSourceRids } from "./importedSourceIdentity";

type Concept = Tables<"Concept">;

export type DiscoverSharedRelationsResult = {
  relations: CrossAppRelation[];
  relTripleSchemas: CrossAppRelationTripleSchema[];
  relTypeSchemas: CrossAppRelationTypeSchema[];
  nodeSchemas: CrossAppNodeSchema[];
  idToRid: Record<number, string>;
};

export const discoverSharedRelations = async (
  client: DGSupabaseClient,
  spaceId: number,
  futureImportRids?: string[],
): Promise<DiscoverSharedRelationsResult> => {
  const response: DiscoverSharedRelationsResult = {
    relations: [],
    relTripleSchemas: [],
    relTypeSchemas: [],
    nodeSchemas: [],
    idToRid: {},
  };
  // TODO: paginate
  const { data: dbAllImportableRelations, error: relError } = await client
    .from("my_concepts")
    .select(
      "*, concepts_of_relation!inner(id, space_id, source_local_id, schema_id)",
    )
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
      ? spaceUriAndLocalIdToRid(spaceMap[spaceId], localId, "note")
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
  const importedNodeRids = await getImportedSourceRids();
  if (futureImportRids !== undefined) {
    futureImportRids.forEach((id) => importedNodeRids.add(id));
  }
  const dbRelations = dbAllImportableRelations.filter((r) => {
    const references = (r.reference_content || {}) as Record<string, number>;
    const sourceId = references["source"];
    const destinationId = references["destination"];
    if (!sourceId || !destinationId) return false;
    return (
      (refToLocalIds.has(sourceId) ||
        importedNodeRids.has(idToRid[sourceId] ?? "")) &&
      (refToLocalIds.has(destinationId) ||
        importedNodeRids.has(idToRid[destinationId] ?? ""))
    );
  });
  const relationSchemaIds = new Set(
    dbRelations.map((r) => r.schema_id).filter((r) => r !== null),
  );
  if (relationSchemaIds.size === 0) return response;
  const { data: dbRelSchemas, error: relSchError } = await client
    .from("my_concepts")
    .select()
    .in("id", [...relationSchemaIds]);
  if (relSchError || !dbRelSchemas) {
    throw relSchError;
  }
  const dbRelTripleSchemasDirect = dbRelSchemas.filter(
    (r) => r.refs !== null && r.refs.length > 0,
  ) as Concept[];
  const dbRelTypeSchemasDirect = dbRelSchemas.filter(
    (r) => r.refs === null || r.refs.length === 0,
  ) as Concept[];
  let dbRelTripleSchemas = dbRelTripleSchemasDirect;
  let dbRelTypeSchemas = dbRelTypeSchemasDirect;

  const missingRelationTypeSchemaIds = new Set<number>(
    dbRelTypeSchemasDirect
      .map(
        (r) =>
          (typeof r.reference_content === "object"
            ? (r.reference_content as Record<string, number>)
            : {})["relation_type"],
      )
      .filter((id) => id !== undefined),
  );

  if (missingRelationTypeSchemaIds.size > 0) {
    const { data, error: tysError } = await client
      .from("my_concepts")
      .select()
      .in("id", [...missingRelationTypeSchemaIds]);
    if (tysError || !data) {
      throw tysError;
    }
    dbRelTypeSchemas = [...dbRelTypeSchemasDirect, ...(data as Concept[])];
  }
  if (dbRelTypeSchemasDirect.length) {
    // Fetch all corresponding triples and filter
    const relTypeIds = dbRelTypeSchemasDirect.map((r) => r.id);
    const { data, error: trsError } = await client
      .from("my_concepts")
      .select()
      .eq("is_schema", true)
      .eq("arity", 2)
      .overlaps("refs", relTypeIds);
    if (trsError || !data) {
      throw trsError;
    }
    const triplesBySchemaId: Record<number, Concept[]> = Object.fromEntries(
      relTypeIds.map((id) => [id, []]),
    );
    data.forEach((c) => {
      triplesBySchemaId[
        ((c.reference_content ?? {}) as Record<string, number>)["relation_type"]
      ].push(c as Concept);
    });
    const tripleIds = new Set<number>();
    for (const relation of dbRelations) {
      const potentialTriples = triplesBySchemaId[relation.schema_id || 0];
      if (potentialTriples === undefined) continue;
      const refs = (relation.reference_content || {}) as Record<string, number>;
      const sourceContent = relation.concepts_of_relation.filter(
        (cr) => cr.id === refs["source"],
      );
      const destinationContent = relation.concepts_of_relation.filter(
        (cr) => cr.id === refs["destination"],
      );
      if (sourceContent.length !== 1 || destinationContent.length !== 1)
        continue;
      const matches = potentialTriples.filter(
        (triple) =>
          ((triple.reference_content ?? {}) as Record<string, number>)[
            "source"
          ] === sourceContent[0].schema_id &&
          ((triple.reference_content ?? {}) as Record<string, number>)[
            "destination"
          ] === destinationContent[0].schema_id,
      );
      if (matches.length === 1) {
        const relationTripleSchemaId = matches[0].id;
        tripleIds.add(relationTripleSchemaId);
        // prentend that the obsidian relation referred to the triple
        // for when we convert
        relation.schema_id = relationTripleSchemaId;
      }
    }
    dbRelTripleSchemas = [
      ...dbRelTripleSchemasDirect,
      ...(data as Concept[]).filter((tr) => tripleIds.has(tr.id || 0)),
    ];
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
    .in("id", [...nodeTypeSchemaIds]);
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
    schemas: dbRelTripleSchemas,
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
