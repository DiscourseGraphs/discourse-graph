/* eslint-disable @typescript-eslint/naming-convention */
import type { Json } from "@repo/database/dbTypes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { uuidv7 } from "uuidv7";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseRelationType, DiscourseRelation } from "~/types";
import { spaceUriAndLocalIdToRid } from "./rid";
import {
  loadRelations,
  addRelationNoCheck,
  findRelationBySourceDestinationType,
} from "./relationsStore";
import { DEFAULT_TLDRAW_COLOR } from "./tldrawColors";
import { mapNodeTypeIdToLocal } from "./importNodes";

type ConceptInRelation = {
  id: number;
  space_id: number;
  source_local_id: string;
};

export type RemoteRelationInstance = {
  id: number;
  source_local_id: string | null;
  schema_id: number | null;
  reference_content: Json;
  refs: number[] | null;
  created: string | null;
  last_modified: string | null;
  concepts_of_relation: ConceptInRelation[];
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
}: {
  plugin: DiscourseGraphPlugin;
  sourceNodeTypeId: string;
  destNodeTypeId: string;
  relationTypeId: string;
  importedCreatedAt?: number;
  importedModifiedAt?: number;
  importedFromRid?: string;
}): Promise<DiscourseRelation> => {
  const existing = plugin.settings.discourseRelations?.find(
    (dr) =>
      dr.sourceId === sourceNodeTypeId &&
      dr.destinationId === destNodeTypeId &&
      dr.relationshipTypeId === relationTypeId,
  );
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
  };
  plugin.settings.discourseRelations = [
    ...(plugin.settings.discourseRelations ?? []),
    newTriple,
  ];
  await plugin.saveSettings();
  return newTriple;
};

/**
 * Fetch relation instances from a remote space. Relation instances are concepts with
 * is_schema=false and schema_id pointing to a relation type (arity=2).
 */
export const fetchRelationInstancesFromSpace = async ({
  client,
  spaceId,
}: {
  client: DGSupabaseClient;
  spaceId: number;
}): Promise<RemoteRelationInstance[]> => {
  const { data: instances, error } = await client
    .from("my_concepts")
    .select(
      "id, source_local_id, schema_id, reference_content, refs, created, last_modified, concepts_of_relation!inner(id, space_id, source_local_id)",
    )
    .eq("space_id", spaceId)
    .eq("is_schema", false)
    .gt("arity", 0);

  if (error || !instances) {
    console.warn("Error fetching relation instances:", error);
    return [];
  }

  return instances as unknown as RemoteRelationInstance[];
};

/**
 * Import relations where both source and destination resolve in this vault (imported or local).
 * keyToRelationEndpointId maps "spaceId:source_local_id" -> endpoint id (RID or nodeInstanceId) to store in RelationInstance.
 */
export const importRelationsForImportedNodes = async ({
  plugin,
  client,
  spaceId,
  spaceUri,
  keyToRelationEndpointId,
  precomputedRelationInstances,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  spaceId: number;
  spaceUri: string;
  keyToRelationEndpointId: Map<string, string>;
  precomputedRelationInstances?: RemoteRelationInstance[];
}): Promise<{ imported: number }> => {
  if (keyToRelationEndpointId.size === 0) return { imported: 0 };

  const relationInstances =
    precomputedRelationInstances ??
    (await fetchRelationInstancesFromSpace({
      client,
      spaceId,
    }));

  const relationsData = await loadRelations(plugin);
  let imported = 0;

  const schemaIds = [
    ...new Set(
      relationInstances
        .map((r) => r.schema_id)
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

  for (const rel of relationInstances) {
    const sourceData = rel.concepts_of_relation.find(
      (cor) =>
        cor.id ===
        (rel.reference_content as Record<string, number | number[]>).source,
    );
    const destData = rel.concepts_of_relation.find(
      (cor) =>
        cor.id ===
        (rel.reference_content as Record<string, number | number[]>)
          .destination,
    );
    if (!sourceData || !destData) continue;

    const sourceKey = `${sourceData.space_id}:${sourceData.source_local_id}`;
    const destKey = `${destData.space_id}:${destData.source_local_id}`;

    const sourceEndpointId = keyToRelationEndpointId.get(sourceKey);
    const destEndpointId = keyToRelationEndpointId.get(destKey);
    if (!sourceEndpointId || !destEndpointId) continue;

    if (!rel.schema_id) continue;

    const sourceRelationTypeId = schemaMap.get(rel.schema_id);
    if (!sourceRelationTypeId) continue;

    const mappedTypeId = await mapRelationTypeToLocal({
      plugin,
      client,
      sourceSpaceId: spaceId,
      sourceSpaceUri: spaceUri,
      sourceRelationTypeId,
    });

    if (!mappedTypeId) continue;

    const { data: conceptSchemas } = await client
      .from("my_concepts")
      .select("id, schema_id")
      .in("id", [sourceData.id, destData.id]);

    let mappedSourceNodeTypeId: string | null = null;
    let mappedDestNodeTypeId: string | null = null;
    if (conceptSchemas && conceptSchemas.length === 2) {
      const byConceptId = Object.fromEntries(
        (conceptSchemas as Array<{ id: number; schema_id: number | null }>).map(
          (r) => [r.id, r.schema_id],
        ),
      );
      const sourceSchemaId = byConceptId[sourceData.id];
      const destSchemaId = byConceptId[destData.id];
      if (sourceSchemaId != null && destSchemaId != null) {
        const uniqueSchemaIds = [...new Set([sourceSchemaId, destSchemaId])];
        const { data: schemaRows } = await client
          .from("my_concepts")
          .select("id, source_local_id")
          .in("id", uniqueSchemaIds);
        if (schemaRows && schemaRows.length === uniqueSchemaIds.length) {
          const schemaIdToLocalId = Object.fromEntries(
            (schemaRows as Array<{ id: number; source_local_id: string }>).map(
              (row) => [row.id, row.source_local_id],
            ),
          );
          const remoteSourceNodeTypeId = schemaIdToLocalId[sourceSchemaId];
          const remoteDestNodeTypeId = schemaIdToLocalId[destSchemaId];
          if (remoteSourceNodeTypeId && remoteDestNodeTypeId) {
            mappedSourceNodeTypeId = await mapNodeTypeIdToLocal({
              plugin,
              client,
              sourceSpaceId: spaceId,
              sourceSpaceUri: spaceUri,
              sourceNodeTypeId: remoteSourceNodeTypeId,
            });
            mappedDestNodeTypeId = await mapNodeTypeIdToLocal({
              plugin,
              client,
              sourceSpaceId: spaceId,
              sourceSpaceUri: spaceUri,
              sourceNodeTypeId: remoteDestNodeTypeId,
            });
          }
        }
      }
    }
    const relationImportedFromRid =
      rel.source_local_id != null && rel.source_local_id !== ""
        ? spaceUriAndLocalIdToRid(spaceUri, rel.source_local_id, "relation")
        : undefined;
    const importedCreatedAt =
      rel.created != null
        ? new Date(
            rel.created + (rel.created.endsWith("Z") ? "" : "Z"),
          ).getTime()
        : undefined;
    const importedModifiedAt =
      rel.last_modified != null
        ? new Date(
            rel.last_modified + (rel.last_modified.endsWith("Z") ? "" : "Z"),
          ).getTime()
        : undefined;

    if (mappedSourceNodeTypeId && mappedDestNodeTypeId) {
      await findOrCreateTriple({
        plugin,
        sourceNodeTypeId: mappedSourceNodeTypeId,
        destNodeTypeId: mappedDestNodeTypeId,
        relationTypeId: mappedTypeId,
        importedCreatedAt,
        importedModifiedAt,
        importedFromRid: relationImportedFromRid,
      });
    }

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
      provisional: false,
    });
    imported++;

    // Reload relations after each add so findRelationBySourceDestinationType sees new data
    Object.assign(relationsData, await loadRelations(plugin));
  }

  return { imported };
};
