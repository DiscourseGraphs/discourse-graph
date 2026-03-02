/* eslint-disable @typescript-eslint/naming-convention */
import type { Json } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseRelationType } from "~/types";
import { spaceUriAndLocalIdToRid } from "./rid";
import {
  loadRelations,
  addRelationNoCheck,
  findRelationBySourceDestinationType,
} from "./relationsStore";
import { DEFAULT_TLDRAW_COLOR } from "./tldrawColors";

type RemoteRelationInstance = {
  id: number;
  source_local_id: string | null;
  schema_id: number | null;
  reference_content: Json;
  refs: number[] | null;
  created: string | null;
  last_modified: string | null;
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
    .select("name, literal_content")
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

  // Match by id first; if id exists locally with different label/complement, use local
  const matchById = plugin.settings.relationTypes.find(
    (rt) => rt.id === sourceRelationTypeId,
  );
  if (matchById) {
    return matchById.id;
  }

  // Match by label
  const matchByLabel = plugin.settings.relationTypes.find(
    (rt) => rt.label === label,
  );
  if (matchByLabel) {
    return matchByLabel.id;
  }

  // Create new relation type
  const now = new Date().getTime();
  const importedFromRid = spaceUriAndLocalIdToRid(
    sourceSpaceUri,
    sourceRelationTypeId,
    "schema",
  );

  const newRelationType: DiscourseRelationType = {
    id: sourceRelationTypeId,
    label,
    complement,
    color: DEFAULT_TLDRAW_COLOR,
    created: now,
    modified: now,
    importedFromRid,
  };
  plugin.settings.relationTypes = [
    ...(plugin.settings.relationTypes ?? []),
    newRelationType,
  ];
  await plugin.saveSettings();
  return newRelationType.id;
};

/**
 * Fetch relation instances from a remote space. Relation instances are concepts with
 * is_schema=false and schema_id pointing to a relation type (arity=2).
 */
const fetchRelationInstancesFromSpace = async ({
  client,
  spaceId,
}: {
  client: DGSupabaseClient;
  spaceId: number;
}): Promise<RemoteRelationInstance[]> => {
  const { data: relationTypes } = await client
    .from("my_concepts")
    .select("id")
    .eq("space_id", spaceId)
    .eq("is_schema", true)
    .eq("arity", 2);

  if (!relationTypes?.length) {
    return [];
  }

  const schemaIds = relationTypes.map((r) => r.id);
  const { data: instances, error } = await client
    .from("my_concepts")
    .select(
      "id, source_local_id, schema_id, reference_content, refs, created, last_modified",
    )
    .eq("space_id", spaceId)
    .eq("is_schema", false)
    .in("schema_id", schemaIds);

  if (error || !instances) {
    console.warn("Error fetching relation instances:", error);
    return [];
  }

  return instances as unknown as RemoteRelationInstance[];
};

/**
 * Resolve source and destination nodeInstanceIds from a relation instance's reference_content.
 * reference_content has { source: conceptId, destination: conceptId }.
 */
const resolveRelationEndpoints = async ({
  client,
  spaceId,
  referenceContent,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  referenceContent: Json;
}): Promise<{ sourceId: string; destinationId: string } | null> => {
  const ref = referenceContent as Record<string, unknown>;
  const sourceConceptId = ref?.source as number | undefined;
  const destConceptId = ref?.destination as number | undefined;

  if (
    sourceConceptId == null ||
    destConceptId == null ||
    typeof sourceConceptId !== "number" ||
    typeof destConceptId !== "number"
  ) {
    return null;
  }

  const { data: concepts } = await client
    .from("my_concepts")
    .select("id, source_local_id")
    .eq("space_id", spaceId)
    .in("id", [sourceConceptId, destConceptId]);

  if (!concepts || concepts.length < 2) {
    return null;
  }

  const byId = new Map(concepts.map((c) => [c.id, c.source_local_id]));
  const sourceId = byId.get(sourceConceptId) as string | undefined;
  const destId = byId.get(destConceptId) as string | undefined;

  if (!sourceId || !destId) {
    return null;
  }

  return { sourceId, destinationId: destId };
};

/**
 * Import relations where both source and destination are in the imported nodes set.
 * Uses importedFromRid for source/destination in RelationInstance (not nodeInstanceId).
 */
export const importRelationsForImportedNodes = async ({
  plugin,
  client,
  spaceId,
  spaceUri,
  nodeKeys,
  keyToRid,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  spaceId: number;
  spaceUri: string;
  nodeKeys: Set<string>;
  keyToRid: Map<string, string>;
}): Promise<{ imported: number }> => {
  if (nodeKeys.size === 0) return { imported: 0 };

  const relationInstances = await fetchRelationInstancesFromSpace({
    client,
    spaceId,
  });

  const relationsData = await loadRelations(plugin);
  let imported = 0;

  for (const rel of relationInstances) {
    const endpoints = await resolveRelationEndpoints({
      client,
      spaceId,
      referenceContent: rel.reference_content,
    });
    if (!endpoints) continue;

    const sourceKey = `${spaceId}:${endpoints.sourceId}`;
    const destKey = `${spaceId}:${endpoints.destinationId}`;

    if (!nodeKeys.has(sourceKey) || !nodeKeys.has(destKey)) {
      continue;
    }

    const sourceRid = keyToRid.get(sourceKey);
    const destRid = keyToRid.get(destKey);
    if (!sourceRid || !destRid) continue;

    if (!rel.schema_id) continue;

    const { data: schemaConcept } = await client
      .from("my_concepts")
      .select("source_local_id")
      .eq("id", rel.schema_id)
      .maybeSingle();

    const sourceRelationTypeId = schemaConcept?.source_local_id as
      | string
      | undefined;
    if (!sourceRelationTypeId) continue;

    const mappedTypeId = await mapRelationTypeToLocal({
      plugin,
      client,
      sourceSpaceId: spaceId,
      sourceSpaceUri: spaceUri,
      sourceRelationTypeId,
    });

    if (!mappedTypeId) continue;

    const existing = findRelationBySourceDestinationType(
      relationsData,
      sourceRid,
      destRid,
      mappedTypeId,
    );
    if (existing) continue;

    const relationImportedFromRid =
      rel.source_local_id != null && rel.source_local_id !== ""
        ? spaceUriAndLocalIdToRid(spaceUri, rel.source_local_id, "relation")
        : undefined;

    await addRelationNoCheck(plugin, {
      type: mappedTypeId,
      source: sourceRid,
      destination: destRid,
      importedFromRid: relationImportedFromRid,
    });
    imported++;

    // Reload relations after each add so findRelationBySourceDestinationType sees new data
    Object.assign(relationsData, await loadRelations(plugin));
  }

  return { imported };
};
