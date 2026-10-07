import type { TFile } from "obsidian";
import type { Json } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { uuidv7 } from "uuidv7";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseRelationType, DiscourseRelation } from "~/types";
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import {
  loadRelations,
  addRelationNoCheck,
  findRelationBySourceDestinationType,
  resolveEndpointToFile,
} from "./relationsStore";
import { DEFAULT_TLDRAW_COLOR } from "./tldrawColors";
import { getSpaceInfoFromIds, parseFrontmatter } from "./importNodes";
import {
  buildSchemaRid,
  findExistingTriple,
  findLocalRelationTypeMatch,
} from "./schemaMatching";
import { fetchSourceTripleRids } from "./sourceTriple";

type ConceptInRelation = {
  id: number;
  space_id: number;
  source_local_id: string;
  schema_id: number | null;
};

export type RemoteRelationInstance = {
  id: number;
  space_id: number;
  source_local_id: string | null;
  schema_id: number | null;
  reference_content: Json;
  refs: number[] | null;
  created: string | null;
  last_modified: string | null;
  concepts_of_relation: ConceptInRelation[];
  author_id: number | null;
};

/**
 * Map a remote relation type to local. Match by id first (use local if id exists with different label/complement),
 * then by label, create if new.
 */
const mapRelationTypeToLocal = async ({
  plugin,
  client,
  sourceSpaceId,
  sourceSpaceUri,
  sourceRelationTypeId,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  sourceSpaceId: number;
  sourceSpaceUri: string;
  sourceRelationTypeId: string;
}): Promise<string> => {
  const { data: schemaData } = await client
    .from("my_concepts")
    .select("name, literal_content, author_id")
    .eq("space_id", sourceSpaceId)
    .eq("is_schema", true)
    .eq("source_local_id", sourceRelationTypeId)
    .maybeSingle();

  if (!schemaData?.name) {
    return sourceRelationTypeId;
  }

  const obj =
    typeof schemaData.literal_content === "string"
      ? (JSON.parse(schemaData.literal_content) as Record<string, unknown>)
      : (schemaData.literal_content as Record<string, unknown>) || {};
  const label = (obj.label as string) || schemaData.name;
  const complement = (obj.complement as string) || "";

  // A local match wins even when label/complement differ — local wording is authoritative
  const localMatch = findLocalRelationTypeMatch({
    localRelationTypes: plugin.settings.relationTypes,
    id: sourceRelationTypeId,
    label,
  });
  if (localMatch) {
    return localMatch.id;
  }

  // Create new relation type
  const now = new Date().getTime();
  const importedFromRid = buildSchemaRid({
    spaceUri: sourceSpaceUri,
    localId: sourceRelationTypeId,
  });

  const newRelationType: DiscourseRelationType = {
    id: sourceRelationTypeId,
    label,
    complement,
    color: DEFAULT_TLDRAW_COLOR,
    created: now,
    modified: now,
    importedFromRid,
    status: "provisional",
    authorId: schemaData.author_id ?? undefined,
  };
  plugin.settings.relationTypes = [
    ...(plugin.settings.relationTypes ?? []),
    newRelationType,
  ];
  await plugin.saveSettings();
  return newRelationType.id;
};

/**
 * Find or create a DiscourseRelation (triple) for the given (source node type, dest node type, relation type).
 * If one exists with the same three ids, return it; otherwise create a new one and add to settings.
 * When creating, uses remote relation instance timestamps and importedFromRid when provided.
 */
const findOrCreateTriple = async ({
  plugin,
  sourceNodeTypeId,
  destNodeTypeId,
  relationTypeId,
  importedCreatedAt,
  importedModifiedAt,
  importedFromRid,
  authorId,
}: {
  plugin: DiscourseGraphPlugin;
  sourceNodeTypeId: string;
  destNodeTypeId: string;
  relationTypeId: string;
  importedCreatedAt?: number;
  importedModifiedAt?: number;
  importedFromRid?: string;
  authorId?: number;
}): Promise<DiscourseRelation> => {
  const existing = findExistingTriple({
    discourseRelations: plugin.settings.discourseRelations ?? [],
    sourceId: sourceNodeTypeId,
    destinationId: destNodeTypeId,
    relationshipTypeId: relationTypeId,
  });
  if (existing) return existing;

  const now = Date.now();
  const created =
    importedCreatedAt != null && !Number.isNaN(importedCreatedAt)
      ? importedCreatedAt
      : now;
  const modified =
    importedModifiedAt != null && !Number.isNaN(importedModifiedAt)
      ? importedModifiedAt
      : now;
  const newTriple: DiscourseRelation = {
    id: uuidv7(),
    sourceId: sourceNodeTypeId,
    destinationId: destNodeTypeId,
    relationshipTypeId: relationTypeId,
    created,
    modified,
    ...(importedFromRid && { importedFromRid }),
    status: "provisional",
    authorId,
  };
  plugin.settings.discourseRelations = [
    ...(plugin.settings.discourseRelations ?? []),
    newTriple,
  ];
  await plugin.saveSettings();
  return newTriple;
};

const RELATION_INSTANCE_COLUMNS =
  "id, space_id, source_local_id, schema_id, reference_content, refs, created, last_modified, author_id, concepts_of_relation!inner(id, space_id, source_local_id, schema_id)";

/**
 * Fetch relation instances from a remote space, or only those with the given local ids.
 * Relation instances are concepts with is_schema=false and schema_id pointing to a relation
 * type (Obsidian) or a triple (Roam).
 */
export const fetchRelationInstancesFromSpace = async ({
  client,
  spaceId,
  sourceLocalIds,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  sourceLocalIds?: string[];
}): Promise<RemoteRelationInstance[]> => {
  let query = client
    .from("my_concepts")
    .select(RELATION_INSTANCE_COLUMNS)
    .eq("space_id", spaceId)
    .eq("is_schema", false)
    .eq("is_relation", true);
  if (sourceLocalIds) query = query.in("source_local_id", sourceLocalIds);
  const { data: instances, error } = await query;

  if (error || !instances) {
    console.warn("Error fetching relation instances:", error);
    return [];
  }

  return instances as unknown as RemoteRelationInstance[];
};

/**
 * Also fetches relations from any space that reference the given nodes: a relation
 * between nodes of two spaces may live in a third. Skips the local space, whose
 * relations the vault already holds.
 */
export const fetchRelationInstancesForImport = async ({
  client,
  localSpaceId,
  spaceIds,
  nodeConceptIds,
}: {
  client: DGSupabaseClient;
  localSpaceId: number;
  spaceIds: number[];
  nodeConceptIds: number[];
}): Promise<RemoteRelationInstance[]> => {
  const bySpace = await Promise.all(
    spaceIds.map((spaceId) =>
      fetchRelationInstancesFromSpace({ client, spaceId }),
    ),
  );
  let referencing: RemoteRelationInstance[] = [];
  if (nodeConceptIds.length > 0) {
    const { data, error } = await client
      .from("my_concepts")
      .select(RELATION_INSTANCE_COLUMNS)
      .eq("is_schema", false)
      .eq("is_relation", true)
      .neq("space_id", localSpaceId)
      .overlaps("refs", nodeConceptIds);
    if (error || !data) {
      console.warn("Error fetching relation instances by node:", error);
    } else {
      referencing = data as unknown as RemoteRelationInstance[];
    }
  }
  const byId = new Map<number, RemoteRelationInstance>();
  for (const rel of [...bySpace.flat(), ...referencing]) byId.set(rel.id, rel);
  return [...byId.values()];
};

const resolveRelationEnds = (
  rel: RemoteRelationInstance,
  keyToRelationEndpointId: Map<string, string>,
):
  | {
      sourceData: ConceptInRelation;
      destData: ConceptInRelation;
      sourceEndpointId: string;
      destEndpointId: string;
    }
  | undefined => {
  const refs = rel.reference_content as Record<string, number | number[]>;
  const sourceData = rel.concepts_of_relation.find(
    (cor) => cor.id === refs.source,
  );
  const destData = rel.concepts_of_relation.find(
    (cor) => cor.id === refs.destination,
  );
  if (!sourceData || !destData) return undefined;

  const sourceEndpointId = keyToRelationEndpointId.get(
    `${sourceData.space_id}:${sourceData.source_local_id}`,
  );
  const destEndpointId = keyToRelationEndpointId.get(
    `${destData.space_id}:${destData.source_local_id}`,
  );
  if (!sourceEndpointId || !destEndpointId) return undefined;
  return { sourceData, destData, sourceEndpointId, destEndpointId };
};

/** Reads the file: the metadata cache can lag behind files written earlier in this import. */
const readLocalNodeTypeId = async ({
  plugin,
  endpointId,
  importedFiles,
}: {
  plugin: DiscourseGraphPlugin;
  endpointId: string;
  importedFiles: Map<string, TFile>;
}): Promise<string> => {
  const file = resolveEndpointToFile(plugin, endpointId, importedFiles);
  if (!file) throw new Error(`No file in this vault for ${endpointId}`);
  const { frontmatter } = parseFrontmatter(await plugin.app.vault.read(file));
  if (typeof frontmatter.nodeTypeId !== "string") {
    throw new Error(`No nodeTypeId in ${file.path}`);
  }
  return frontmatter.nodeTypeId;
};

const toTimestamp = (date: string | null): number | undefined =>
  date == null
    ? undefined
    : new Date(date + (date.endsWith("Z") ? "" : "Z")).getTime();

/**
 * Import relations where both source and destination resolve in this vault (imported or local).
 * keyToRelationEndpointId maps "spaceId:source_local_id" -> endpoint id (RID or nodeInstanceId) to store in RelationInstance.
 * A relation that cannot be imported is skipped and counted as failed.
 */
export const importRelationsForImportedNodes = async ({
  plugin,
  client,
  relationInstances,
  keyToRelationEndpointId,
  importedFiles,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  relationInstances: RemoteRelationInstance[];
  keyToRelationEndpointId: Map<string, string>;
  importedFiles: Map<string, TFile>;
}): Promise<{ imported: number; failed: number }> => {
  const importable = relationInstances.flatMap((rel) => {
    const ends = resolveRelationEnds(rel, keyToRelationEndpointId);
    return ends ? [{ rel, ...ends }] : [];
  });
  if (importable.length === 0) return { imported: 0, failed: 0 };

  const relationsData = await loadRelations(plugin);
  let imported = 0;
  let failed = 0;

  const schemaIds = [
    ...new Set(
      importable
        .map(({ rel }) => rel.schema_id)
        .filter((id): id is number => id != null),
    ),
  ];
  const schemaMap = new Map<number, string>();
  if (schemaIds.length > 0) {
    const { data: schemaConcepts } = await client
      .from("my_concepts")
      .select("id, source_local_id")
      .in("id", schemaIds);
    for (const row of schemaConcepts ?? []) {
      if (row?.id != null && typeof row.source_local_id === "string") {
        schemaMap.set(row.id, row.source_local_id);
      }
    }
  }

  const relationSpaceInfo = await getSpaceInfoFromIds(client, [
    ...new Set(importable.map(({ rel }) => rel.space_id)),
  ]);

  let sourceTripleRids = new Map<number, string>();
  try {
    sourceTripleRids = await fetchSourceTripleRids({
      client,
      relations: importable.map(({ rel }) => rel),
    });
  } catch (error) {
    console.warn("Could not look up the source triples of relations:", error);
  }

  for (const { rel, sourceEndpointId, destEndpointId } of importable) {
    try {
      if (!rel.schema_id) continue;

      const sourceRelationTypeId = schemaMap.get(rel.schema_id);
      if (!sourceRelationTypeId) continue;

      // Type and RID come from the relation's own space, which may be neither end's.
      const relationSpaceUri = relationSpaceInfo.get(rel.space_id)?.url;
      if (!relationSpaceUri) {
        throw new Error(`Unknown space ${rel.space_id}`);
      }

      const mappedTypeId = await mapRelationTypeToLocal({
        plugin,
        client,
        sourceSpaceId: rel.space_id,
        sourceSpaceUri: relationSpaceUri,
        sourceRelationTypeId,
      });

      if (!mappedTypeId) continue;

      const mappedSourceNodeTypeId = await readLocalNodeTypeId({
        plugin,
        endpointId: sourceEndpointId,
        importedFiles,
      });
      const mappedDestNodeTypeId = await readLocalNodeTypeId({
        plugin,
        endpointId: destEndpointId,
        importedFiles,
      });

      const relationImportedFromRid =
        rel.source_local_id != null && rel.source_local_id !== ""
          ? spaceUriAndLocalIdToRid(
              relationSpaceUri,
              rel.source_local_id,
              "relation",
            )
          : undefined;

      const authorId = rel.author_id ?? undefined;
      await findOrCreateTriple({
        plugin,
        sourceNodeTypeId: mappedSourceNodeTypeId,
        destNodeTypeId: mappedDestNodeTypeId,
        relationTypeId: mappedTypeId,
        importedCreatedAt: toTimestamp(rel.created),
        importedModifiedAt: toTimestamp(rel.last_modified),
        // Without a unique source triple, keep the relation's RID: an imported triple
        // needs some importedFromRid, or isAcceptedSchema treats it as a local one.
        importedFromRid:
          sourceTripleRids.get(rel.id) ?? relationImportedFromRid,
        authorId,
      });

      const existing = findRelationBySourceDestinationType(
        relationsData,
        sourceEndpointId,
        destEndpointId,
        mappedTypeId,
      );
      if (existing) continue;

      await addRelationNoCheck(plugin, {
        type: mappedTypeId,
        source: sourceEndpointId,
        destination: destEndpointId,
        importedFromRid: relationImportedFromRid,
        tentative: false,
        authorId,
      });
      imported++;

      // Reload relations after each add so findRelationBySourceDestinationType sees new data
      Object.assign(relationsData, await loadRelations(plugin));
    } catch (error) {
      console.warn(`Could not import relation ${rel.id}:`, error);
      failed++;
    }
  }

  return { imported, failed };
};
