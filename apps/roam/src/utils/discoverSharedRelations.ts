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
import {
  type NodeTypeIdentity,
  parseTripleEndNames,
  pickTripleCandidate,
} from "@repo/database/lib/tripleMatching";

type Concept = Tables<"Concept">;

// A visible triple of an Obsidian relation's relation type.
export type TripleCandidate = {
  rid: string;
  label?: string;
  complement?: string;
  modifiedAt?: Date;
};

export type DiscoverSharedRelationsResult = {
  relations: CrossAppRelation[];
  relTripleSchemas: CrossAppRelationTripleSchema[];
  relTypeSchemas: CrossAppRelationTypeSchema[];
  nodeSchemas: CrossAppNodeSchema[];
  // By relation type RID.
  tripleCandidatesByRelationType: Record<string, TripleCandidate[]>;
  // By relation RID; set only when exactly one candidate matches.
  matchedTripleByRelation: Record<string, string>;
  // One failure message per relation dropped because its schema is not visible.
  skippedRelations: string[];
};

export const discoverSharedRelations = async (
  client: DGSupabaseClient,
  spaceId: number,
): Promise<DiscoverSharedRelationsResult> => {
  const response: DiscoverSharedRelationsResult = {
    relations: [],
    relTripleSchemas: [],
    relTypeSchemas: [],
    nodeSchemas: [],
    tripleCandidatesByRelationType: {},
    matchedTripleByRelation: {},
    skippedRelations: [],
  };
  // TODO: paginate
  const { data: dbAllImportableRelations, error: relError } = await client
    .from("my_concepts")
    .select(
      "*, concepts_of_relation!inner(id, space_id, source_local_id, schema_id)",
    )
    .neq("space_id", spaceId)
    .eq("is_schema", false)
    .eq("is_relation", true);

  if (relError) throw relError;
  if (!dbAllImportableRelations || dbAllImportableRelations.length === 0)
    return response;
  const relatedNodeInfo = dbAllImportableRelations
    .map((r) => r.concepts_of_relation)
    .flat();
  const spaceIds = new Set(relatedNodeInfo.map(({ space_id }) => space_id!));
  // A relation between two imported nodes shares a space with neither end.
  dbAllImportableRelations.forEach(({ space_id }) => spaceIds.add(space_id!));
  spaceIds.add(spaceId);
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
  const relationRid = (r: {
    space_id: number | null;
    source_local_id: string | null;
  }) =>
    r.space_id !== null && r.space_id in spaceMap
      ? spaceUriAndLocalIdToRid(
          spaceMap[r.space_id],
          r.source_local_id!,
          "relation",
        )
      : `${r.space_id}/${r.source_local_id}`;
  const relatedRelations = dbAllImportableRelations.filter((r) => {
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
    relatedRelations.map((r) => r.schema_id).filter((r) => r !== null),
  );
  const { data: dbRelSchemas, error: relSchError } =
    relationSchemaIds.size === 0
      ? { data: [], error: null }
      : await client
          .from("my_concepts")
          .select()
          .in("id", [...relationSchemaIds]);
  if (relSchError) throw relSchError;
  if (!dbRelSchemas) throw new Error("Missing schemas");
  // A group can see a relation without its schema, for instance one published before
  // relation types and triples were granted with it. Such a relation cannot be
  // converted; it is retried on every import, so it arrives once the schema is granted.
  const visibleSchemaIds = new Set(dbRelSchemas.map(({ id }) => id));
  const dbRelations = relatedRelations.filter(
    (r) => r.schema_id !== null && visibleSchemaIds.has(r.schema_id),
  );
  response.skippedRelations = relatedRelations
    .filter((r) => !dbRelations.includes(r))
    .map((r) => `${relationRid(r)}: its relation type is not visible`);
  if (dbRelations.length === 0) return response;
  const dbRelTripleSchemasDirect = dbRelSchemas.filter(
    (r) => r.refs !== null && r.refs.length > 0,
  ) as Concept[];
  const dbRelTypeSchemasDirect = dbRelSchemas.filter(
    (r) => r.refs === null || r.refs.length === 0,
  ) as Concept[];
  const dbRelTripleSchemas = dbRelTripleSchemasDirect;
  let dbRelTypeSchemas = dbRelTypeSchemasDirect;

  const missingRelationTypeSchemaIds = new Set<number>(
    dbRelTripleSchemasDirect
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
    if (tysError) throw tysError;
    if (!data) throw new Error("Missing relation type schemas");
    dbRelTypeSchemas = [...dbRelTypeSchemasDirect, ...(data as Concept[])];
  }
  // Obsidian relations point to a relation type. The importer matches the triple
  // locally; these candidates only supply provenance.
  if (dbRelTypeSchemasDirect.length) {
    const relTypeIds = dbRelTypeSchemasDirect.map((r) => r.id);
    const { data, error: trsError } = await client
      .from("my_concepts")
      .select()
      .eq("is_schema", true)
      .eq("is_relation", true)
      .overlaps("refs", relTypeIds);
    if (trsError) throw trsError;
    if (!data) throw new Error("Missing relation triple schemas");
    const candidateTriples = data as Concept[];
    const refsOf = (c: { reference_content: unknown }) =>
      (c.reference_content ?? {}) as Record<string, number>;
    const schemaRid = (c: {
      space_id: number | null;
      source_local_id: string | null;
    }) =>
      c.space_id !== null &&
      c.space_id in spaceMap &&
      c.source_local_id !== null
        ? spaceUriAndLocalIdToRid(
            spaceMap[c.space_id],
            c.source_local_id,
            "schema",
          )
        : undefined;

    // Triple end types may be hidden; relation end types are visible with the relation.
    const endSchemaIds = new Set<number>(
      [
        ...candidateTriples.flatMap((t) => [
          refsOf(t).source,
          refsOf(t).destination,
        ]),
        ...dbRelations.flatMap((r) =>
          r.concepts_of_relation.map(({ schema_id }) => schema_id),
        ),
      ].filter((id): id is number => typeof id === "number"),
    );
    const { data: endSchemas, error: esError } = await client
      .from("my_concepts")
      .select()
      .in("id", [...endSchemaIds]);
    if (esError) throw esError;
    const identityById: Record<number, NodeTypeIdentity> = {};
    for (const s of endSchemas ?? []) {
      if (s.id === null) continue;
      const literal = (s.literal_content ?? {}) as Record<string, unknown>;
      identityById[s.id] = {
        rid: schemaRid(s),
        localId: s.source_local_id ?? undefined,
        importedFromRid:
          typeof literal.importedFromRid === "string"
            ? literal.importedFromRid
            : undefined,
        name: s.name ?? undefined,
      };
    }

    const relTypeById = Object.fromEntries(
      dbRelTypeSchemasDirect.map((r) => [r.id, r]),
    );
    const candidatesByRelationTypeId: Record<
      number,
      {
        candidate: TripleCandidate;
        source: NodeTypeIdentity;
        destination: NodeTypeIdentity;
      }[]
    > = {};
    for (const triple of candidateTriples) {
      const refs = refsOf(triple);
      const relationType = relTypeById[refs.relation_type];
      const rid = schemaRid(triple);
      if (relationType === undefined || rid === undefined) continue;
      const literal = (triple.literal_content ?? {}) as Record<string, unknown>;
      const label =
        typeof literal.label === "string" ? literal.label : relationType.name;
      const complement =
        typeof literal.complement === "string" ? literal.complement : undefined;
      const names = parseTripleEndNames(triple.name, label);
      (candidatesByRelationTypeId[relationType.id] ??= []).push({
        candidate: {
          rid,
          label,
          complement,
          modifiedAt: new Date(triple.last_modified + "Z"),
        },
        source: identityById[refs.source] ?? { name: names?.source },
        destination: identityById[refs.destination] ?? {
          name: names?.destination,
        },
      });
    }
    for (const [relationTypeId, candidates] of Object.entries(
      candidatesByRelationTypeId,
    )) {
      const relationTypeRid = schemaRid(relTypeById[Number(relationTypeId)]);
      if (relationTypeRid === undefined) continue;
      response.tripleCandidatesByRelationType[relationTypeRid] = candidates.map(
        ({ candidate }) => candidate,
      );
    }

    for (const relation of dbRelations) {
      const candidates = candidatesByRelationTypeId[relation.schema_id ?? 0];
      if (candidates === undefined) continue;
      const refs = refsOf(relation);
      const endIdentity = (id: number): NodeTypeIdentity => {
        const ends = relation.concepts_of_relation.filter((cr) => cr.id === id);
        if (ends.length !== 1 || ends[0].schema_id === null) return {};
        return identityById[ends[0].schema_id] ?? {};
      };
      const picked = pickTripleCandidate(candidates, {
        source: endIdentity(refs.source),
        destination: endIdentity(refs.destination),
      });
      if (picked === undefined) continue;
      response.matchedTripleByRelation[relationRid(relation)] = picked.rid;
    }
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
  if (nsError) throw nsError;
  if (!dbNodeTypeSchemas) throw new Error("Missing relation type schemas");
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
    tripleCandidatesByRelationType: response.tripleCandidatesByRelationType,
    matchedTripleByRelation: response.matchedTripleByRelation,
    skippedRelations: response.skippedRelations,
  };
};
