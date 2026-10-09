import { ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseRelation } from "~/types";
import { fetchRelationInstancesFromSpace } from "./importRelations";
import { loadRelations } from "./relationsStore";
import { fetchSourceTripleRids } from "./sourceTriple";
import { getSpaceIdsBySpaceUris } from "./spaceFromRid";
import { getLoggedInClient } from "./supabaseContext";

// URL RIDs (Roam spaces) have no subtype.
const ridSubtype = (rid: string): string | undefined =>
  rid.match(/^orn:\w+\.(\w+):/)?.[1];

/**
 * Triples that older relation imports stamped with the creating instance's RID: a
 * `relation` RID, or, where RIDs carry no subtype, an imported instance's RID.
 */
export const findTriplesWithRelationRid = (
  triples: DiscourseRelation[],
  relationInstanceRids: Set<string>,
): DiscourseRelation[] =>
  triples.filter(
    ({ importedFromRid }) =>
      importedFromRid !== undefined &&
      (ridSubtype(importedFromRid) === "relation" ||
        relationInstanceRids.has(importedFromRid)),
  );

/**
 * A triple with no unique source triple keeps its RID, as in relation import. Repaired
 * triples get a new `modified` so the next sync uploads the accepted ones.
 */
export const repairImportedTripleRids = async (
  plugin: DiscourseGraphPlugin,
): Promise<void> => {
  const relationsData = await loadRelations(plugin);
  const relationInstanceRids = new Set(
    Object.values(relationsData.relations).flatMap(({ importedFromRid }) =>
      importedFromRid ? [importedFromRid] : [],
    ),
  );
  const badTriples = findTriplesWithRelationRid(
    plugin.settings.discourseRelations ?? [],
    relationInstanceRids,
  );
  if (badTriples.length === 0) return;

  const client = await getLoggedInClient(plugin);
  if (!client) return;

  const badRids = [...new Set(badTriples.map((t) => t.importedFromRid!))];
  const parsed = badRids.map((rid) => ({
    rid,
    ...ridToSpaceUriAndLocalId(rid),
  }));
  const spaceIdsByUri = await getSpaceIdsBySpaceUris(
    client,
    parsed.map(({ spaceUri }) => spaceUri),
  );

  const replacements = new Map<string, string>();
  for (const [spaceUri, spaceId] of spaceIdsByUri) {
    const inSpace = parsed.filter((p) => p.spaceUri === spaceUri);
    const relations = await fetchRelationInstancesFromSpace({
      client,
      spaceId,
      sourceLocalIds: inSpace.map(({ sourceLocalId }) => sourceLocalId),
    });
    const tripleRids = await fetchSourceTripleRids({ client, relations });
    for (const rel of relations) {
      const tripleRid = tripleRids.get(rel.id);
      const badRid = inSpace.find(
        ({ sourceLocalId }) => sourceLocalId === rel.source_local_id,
      )?.rid;
      if (tripleRid !== undefined && badRid !== undefined)
        replacements.set(badRid, tripleRid);
    }
  }
  console.debug(
    `Triple RID repair: ${badRids.length} relation RID(s) found on triples, ${replacements.size} matched a source triple`,
  );
  if (replacements.size === 0) return;

  const now = Date.now();
  plugin.settings.discourseRelations = plugin.settings.discourseRelations.map(
    (triple) => {
      const tripleRid =
        triple.importedFromRid === undefined
          ? undefined
          : replacements.get(triple.importedFromRid);
      return tripleRid === undefined
        ? triple
        : { ...triple, importedFromRid: tripleRid, modified: now };
    },
  );
  await plugin.saveSettings();
};
