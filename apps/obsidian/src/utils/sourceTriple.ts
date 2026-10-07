import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  type NodeTypeIdentity,
  parseTripleEndNames,
  pickTripleCandidate,
} from "@repo/database/lib/tripleMatching";
import { getSpaceInfoFromIds } from "./importNodes";
import type { RemoteRelationInstance } from "./importRelations";
import { buildSchemaRid } from "./schemaMatching";

export type SchemaRow = {
  id: number;
  space_id: number;
  source_local_id: string;
  name: string;
  literal_content: unknown;
  reference_content: unknown;
};

const SCHEMA_COLUMNS =
  "id, space_id, source_local_id, name, literal_content, reference_content";

const refsOf = (row: { reference_content: unknown }): Record<string, number> =>
  typeof row.reference_content === "object" && row.reference_content !== null
    ? (row.reference_content as Record<string, number>)
    : {};

const literalOf = (row: {
  literal_content: unknown;
}): Record<string, unknown> =>
  typeof row.literal_content === "object" && row.literal_content !== null
    ? (row.literal_content as Record<string, unknown>)
    : {};

// A triple references its ends; a relation type references nothing.
const isTriple = (row: SchemaRow): boolean =>
  refsOf(row).source !== undefined && refsOf(row).destination !== undefined;

const endSchemaIds = (rel: RemoteRelationInstance): number[] =>
  rel.concepts_of_relation.flatMap(({ schema_id }) =>
    schema_id === null ? [] : [schema_id],
  );

/**
 * Returns source triple RIDs by relation concept id, for relations with a unique match.
 * A Roam relation's schema is already a triple; an Obsidian relation's schema is a
 * relation type, so its space's triples of that type are matched on the end types.
 */
export const selectSourceTripleRids = ({
  relations,
  schemasById,
  candidateTriples,
  spaceUriById,
}: {
  relations: RemoteRelationInstance[];
  schemasById: Map<number, SchemaRow>;
  candidateTriples: SchemaRow[];
  spaceUriById: Map<number, string>;
}): Map<number, string> => {
  const ridOf = (row: SchemaRow): string | undefined => {
    const spaceUri = spaceUriById.get(row.space_id);
    return spaceUri === undefined
      ? undefined
      : buildSchemaRid({ spaceUri, localId: row.source_local_id });
  };
  const identityOf = (row: SchemaRow): NodeTypeIdentity => {
    const importedFromRid = literalOf(row).importedFromRid;
    return {
      rid: ridOf(row),
      localId: row.source_local_id,
      importedFromRid:
        typeof importedFromRid === "string" ? importedFromRid : undefined,
      name: row.name,
    };
  };

  const result = new Map<number, string>();
  for (const rel of relations) {
    const schema =
      rel.schema_id === null ? undefined : schemasById.get(rel.schema_id);
    if (schema === undefined) continue;
    if (isTriple(schema)) {
      const rid = ridOf(schema);
      if (rid !== undefined) result.set(rel.id, rid);
      continue;
    }

    const endIdentity = (conceptId: number | undefined): NodeTypeIdentity => {
      const end = rel.concepts_of_relation.find(({ id }) => id === conceptId);
      const endSchema =
        end?.schema_id == null ? undefined : schemasById.get(end.schema_id);
      return endSchema === undefined ? {} : identityOf(endSchema);
    };
    const relRefs = refsOf(rel);
    const label = literalOf(schema).label;
    const candidates = candidateTriples
      .filter(
        (triple) =>
          triple.space_id === schema.space_id &&
          refsOf(triple).relation_type === schema.id,
      )
      .flatMap((triple) => {
        const rid = ridOf(triple);
        if (rid === undefined) return [];
        // An end type the reader cannot see is known only by its name in the triple's name.
        const names = parseTripleEndNames(
          triple.name,
          typeof label === "string" ? label : schema.name,
        );
        const end = (role: "source" | "destination"): NodeTypeIdentity => {
          const endSchema = schemasById.get(refsOf(triple)[role] ?? -1);
          return endSchema === undefined
            ? { name: names?.[role] }
            : identityOf(endSchema);
        };
        return [
          {
            candidate: rid,
            source: end("source"),
            destination: end("destination"),
          },
        ];
      });
    const picked = pickTripleCandidate(candidates, {
      source: endIdentity(relRefs.source),
      destination: endIdentity(relRefs.destination),
    });
    if (picked !== undefined) result.set(rel.id, picked);
  }
  return result;
};

const fetchSchemas = async (
  client: DGSupabaseClient,
  ids: number[],
): Promise<SchemaRow[]> => {
  if (ids.length === 0) return [];
  const { data, error } = await client
    .from("my_concepts")
    .select(SCHEMA_COLUMNS)
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as SchemaRow[];
};

export const fetchSourceTripleRids = async ({
  client,
  relations,
}: {
  client: DGSupabaseClient;
  relations: RemoteRelationInstance[];
}): Promise<Map<number, string>> => {
  if (relations.length === 0) return new Map();
  const schemasById = new Map<number, SchemaRow>();
  const addSchemas = (rows: SchemaRow[]) => {
    for (const row of rows) schemasById.set(row.id, row);
  };

  addSchemas(
    await fetchSchemas(client, [
      ...new Set(
        relations.flatMap((rel) => [
          ...(rel.schema_id === null ? [] : [rel.schema_id]),
          ...endSchemaIds(rel),
        ]),
      ),
    ]),
  );

  const relationTypeIds = [
    ...new Set(
      relations.flatMap((rel) => {
        const schema =
          rel.schema_id === null ? undefined : schemasById.get(rel.schema_id);
        return schema === undefined || isTriple(schema) ? [] : [schema.id];
      }),
    ),
  ];
  let candidateTriples: SchemaRow[] = [];
  if (relationTypeIds.length > 0) {
    const { data, error } = await client
      .from("my_concepts")
      .select(SCHEMA_COLUMNS)
      .eq("is_schema", true)
      .eq("is_relation", true)
      .overlaps("refs", relationTypeIds);
    if (error) throw error;
    candidateTriples = (data ?? []) as SchemaRow[];
    addSchemas(
      await fetchSchemas(client, [
        ...new Set(
          candidateTriples
            .flatMap((triple) => [
              refsOf(triple).source,
              refsOf(triple).destination,
            ])
            .filter(
              (id): id is number =>
                typeof id === "number" && !schemasById.has(id),
            ),
        ),
      ]),
    );
  }

  const spaceInfo = await getSpaceInfoFromIds(client, [
    ...new Set(
      [...schemasById.values(), ...candidateTriples].map(
        ({ space_id }) => space_id,
      ),
    ),
  ]);
  const spaceUriById = new Map(
    [...spaceInfo].map(([id, { url }]) => [id, url]),
  );

  return selectSourceTripleRids({
    relations,
    schemasById,
    candidateTriples,
    spaceUriById,
  });
};
