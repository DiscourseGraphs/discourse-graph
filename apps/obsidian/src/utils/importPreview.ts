/* eslint-disable @typescript-eslint/naming-convention */
import type DiscourseGraphPlugin from "~/index";
import type { ImportableNode } from "~/types";
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import {
  getImportedNodesInfo,
  getLocalNodeKeyToEndpointId,
} from "./relationsStore";
import { getSpaceUris } from "./importNodes";
import { QueryEngine } from "~/services/QueryEngine";
import {
  fetchRelationInstancesFromSpace,
  type RemoteRelationInstance,
} from "./importRelations";
import { spaceUriAndLocalIdToRid } from "./rid";

export type RelationTriplet = {
  sourceNodeTypeName: string;
  relationTypeLabel: string;
  destNodeTypeName: string;
  /** Whether this specific triplet combo is new (not in discourseRelations) */
  isNewTriplet: boolean;
};

export type ImportPreviewData = {
  // Display data
  selectedNodeCount: number;
  newNodeTypeSchemas: Array<{ id: string; name: string }>;
  relationInstanceCount: number;
  newRelationTypeSchemas: Array<{
    id: string;
    label: string;
    complement: string;
  }>;
  relationTriplets: RelationTriplet[];
  // Pre-fetched data to pass through to import (avoids re-querying)
  nodeKeys: Set<string>;
  keyToRid: Map<string, string>;
  /** Key (spaceId:source_local_id) -> endpoint id (RID) for relation import; includes local nodes */
  keyToRelationEndpointId: Map<string, string>;
  /** Relation instances per spaceId, for reuse during import */
  relationInstancesBySpace: Map<number, RemoteRelationInstance[]>;
};

export const computeImportPreview = async ({
  plugin,
  selectedNodes,
}: {
  plugin: DiscourseGraphPlugin;
  selectedNodes: ImportableNode[];
}): Promise<ImportPreviewData> => {
  const client = await getLoggedInClient(plugin);
  if (!client) {
    throw new Error("Cannot get Supabase client");
  }
  const context = await getSupabaseContext(plugin);
  if (!context) {
    throw new Error("Cannot get Supabase context");
  }

  const queryEngine = new QueryEngine(plugin.app);

  // --- Node type detection (without creating) ---
  const nodesBySpace = new Map<number, ImportableNode[]>();
  for (const node of selectedNodes) {
    if (!nodesBySpace.has(node.spaceId)) {
      nodesBySpace.set(node.spaceId, []);
    }
    nodesBySpace.get(node.spaceId)!.push(node);
  }

  const spaceIds = [...nodesBySpace.keys()];
  const spaceUris = await getSpaceUris(client, spaceIds);

  const newNodeTypeSchemas: Array<{ id: string; name: string }> = [];
  const seenNodeTypeIds = new Set<string>();
  // Maps source_local_id -> name for all node type schemas we encounter (for triplet resolution)
  const nodeTypeIdToName = new Map<string, string>();

  // Pre-populate with local node types
  for (const nt of plugin.settings.nodeTypes) {
    nodeTypeIdToName.set(nt.id, nt.name);
  }

  for (const [spaceId, nodes] of nodesBySpace.entries()) {
    // Get schema_ids for the selected node instances
    const nodeInstanceIds = nodes.map((n) => n.nodeInstanceId);
    const { data: conceptRows } = await client
      .from("my_concepts")
      .select("source_local_id, schema_id")
      .eq("space_id", spaceId)
      .eq("is_schema", false)
      .in("source_local_id", nodeInstanceIds);

    if (!conceptRows) continue;

    const schemaIds = [
      ...new Set(
        (
          conceptRows as Array<{
            source_local_id: string;
            schema_id: number | null;
          }>
        )
          .map((r) => r.schema_id)
          .filter((id): id is number => id != null),
      ),
    ];

    if (schemaIds.length === 0) continue;

    // Resolve schema_ids to node type info
    const { data: schemaRows } = await client
      .from("my_concepts")
      .select("source_local_id, name")
      .eq("space_id", spaceId)
      .eq("is_schema", true)
      .in("id", schemaIds);

    if (!schemaRows) continue;

    for (const schema of schemaRows as Array<{
      source_local_id: string;
      name: string;
    }>) {
      const sourceNodeTypeId = schema.source_local_id;

      // Track name for triplet resolution
      if (!nodeTypeIdToName.has(sourceNodeTypeId)) {
        nodeTypeIdToName.set(sourceNodeTypeId, schema.name);
      }

      if (seenNodeTypeIds.has(sourceNodeTypeId)) continue;
      seenNodeTypeIds.add(sourceNodeTypeId);

      // Check against local node types (mirrors mapNodeTypeIdToLocal logic without side effects)
      const matchById = plugin.settings.nodeTypes.find(
        (nt) => nt.id === sourceNodeTypeId,
      );
      if (matchById) continue;

      const matchByName = plugin.settings.nodeTypes.find(
        (nt) => nt.name === schema.name,
      );
      if (matchByName) continue;

      // This is a new node type that would be created
      newNodeTypeSchemas.push({ id: sourceNodeTypeId, name: schema.name });
    }
  }

  // --- Relation detection ---
  // Build combined nodeKeys from previously imported nodes + currently selected nodes
  const { nodeKeys, keyToRid } = await getImportedNodesInfo({
    queryEngine,
    plugin,
    client,
  });

  // Add currently selected nodes to the sets
  for (const [spaceId, nodes] of nodesBySpace.entries()) {
    const spaceUri = spaceUris.get(spaceId);
    if (!spaceUri) continue;
    for (const node of nodes) {
      const key = `${spaceId}:${node.nodeInstanceId}`;
      nodeKeys.add(key);
      if (!keyToRid.has(key)) {
        keyToRid.set(
          key,
          spaceUriAndLocalIdToRid(spaceUri, node.nodeInstanceId, "note"),
        );
      }
    }
  }

  const localMap = getLocalNodeKeyToEndpointId(plugin, context.spaceId);
  const keyToRelationEndpointId = new Map([...keyToRid, ...localMap]);

  // Fetch relation instances per space and collect matching ones with endpoint concept ids
  const relationInstancesBySpace = new Map<number, RemoteRelationInstance[]>();
  const matchingRelations: Array<{
    rel: RemoteRelationInstance;
    sourceConceptId: number;
    destConceptId: number;
    spaceId: number;
  }> = [];

  for (const spaceId of spaceIds) {
    const instances = await fetchRelationInstancesFromSpace({
      client,
      spaceId,
    });
    relationInstancesBySpace.set(spaceId, instances);

    // Filter: only relations where both endpoints resolve (imported or local)
    for (const rel of instances) {
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

      if (keyToRelationEndpointId.has(sourceKey) && keyToRelationEndpointId.has(destKey)) {
        matchingRelations.push({
          rel,
          sourceConceptId: sourceData.id,
          destConceptId: destData.id,
          spaceId,
        });
      }
    }
  }

  // Resolve relation schema_ids to detect new relation types
  const newRelationTypeSchemas: Array<{
    id: string;
    label: string;
    complement: string;
  }> = [];
  const seenRelationTypeIds = new Set<string>();
  // Maps relation type source_local_id -> { label, complement } for triplet display
  const relationTypeIdToInfo = new Map<
    string,
    { label: string; complement: string }
  >();

  // Pre-populate with local relation types
  for (const rt of plugin.settings.relationTypes) {
    relationTypeIdToInfo.set(rt.id, {
      label: rt.label,
      complement: rt.complement ?? "",
    });
  }

  const relationSchemaIds = [
    ...new Set(
      matchingRelations
        .map((m) => m.rel.schema_id)
        .filter((id): id is number => id != null),
    ),
  ];

  // Maps numeric schema id -> source_local_id for relation types
  const relSchemaIdToLocalId = new Map<number, string>();

  if (relationSchemaIds.length > 0) {
    // Resolve schema numeric ids to source_local_id
    const { data: schemaIdRows } = await client
      .from("my_concepts")
      .select("id, source_local_id")
      .in("id", relationSchemaIds);

    for (const row of (schemaIdRows ?? []) as Array<{
      id: number;
      source_local_id: string;
    }>) {
      relSchemaIdToLocalId.set(row.id, row.source_local_id);
    }

    // For each unique relation type local id, check if it's new
    const uniqueRelTypeLocalIds = [...new Set(relSchemaIdToLocalId.values())];

    for (const relTypeLocalId of uniqueRelTypeLocalIds) {
      if (seenRelationTypeIds.has(relTypeLocalId)) continue;
      seenRelationTypeIds.add(relTypeLocalId);

      // Check against local relation types (mirrors mapRelationTypeToLocal logic without side effects)
      const matchById = plugin.settings.relationTypes.find(
        (rt) => rt.id === relTypeLocalId,
      );
      if (matchById) continue;

      // Need to fetch the schema's name and literal_content to get label/complement
      const schemaNumericId = [...relSchemaIdToLocalId.entries()].find(
        ([, localId]) => localId === relTypeLocalId,
      )?.[0];
      if (schemaNumericId == null) continue;

      const { data: schemaData } = await client
        .from("my_concepts")
        .select("name, literal_content, space_id")
        .eq("id", schemaNumericId)
        .maybeSingle();

      if (!schemaData?.name) continue;

      const obj =
        typeof schemaData.literal_content === "string"
          ? (JSON.parse(schemaData.literal_content) as Record<string, unknown>)
          : (schemaData.literal_content as Record<string, unknown>) || {};
      const label = (obj.label as string) || schemaData.name;
      const complement = (obj.complement as string) || "";

      // Track for triplet display
      relationTypeIdToInfo.set(relTypeLocalId, { label, complement });

      const matchByLabel = plugin.settings.relationTypes.find(
        (rt) => rt.label === label,
      );
      if (matchByLabel) continue;

      newRelationTypeSchemas.push({ id: relTypeLocalId, label, complement });
    }
  }

  // --- Resolve relation triplets ---
  // Collect all endpoint concept ids we need to resolve node types for
  const allEndpointConceptIds = [
    ...new Set(
      matchingRelations.flatMap((m) => [m.sourceConceptId, m.destConceptId]),
    ),
  ];

  // Batch fetch schema_id for all endpoint concepts
  const conceptIdToSchemaId = new Map<number, number>();
  if (allEndpointConceptIds.length > 0) {
    const { data: conceptSchemas } = await client
      .from("my_concepts")
      .select("id, schema_id")
      .in("id", allEndpointConceptIds);

    for (const row of (conceptSchemas ?? []) as Array<{
      id: number;
      schema_id: number | null;
    }>) {
      if (row.schema_id != null) {
        conceptIdToSchemaId.set(row.id, row.schema_id);
      }
    }
  }

  // Batch fetch source_local_id + name for all node type schemas
  const nodeSchemaNumericIds = [...new Set(conceptIdToSchemaId.values())];
  // Maps numeric schema id -> { source_local_id, name }
  const nodeSchemaIdToInfo = new Map<
    number,
    { source_local_id: string; name: string }
  >();
  if (nodeSchemaNumericIds.length > 0) {
    const { data: nodeSchemaRows } = await client
      .from("my_concepts")
      .select("id, source_local_id, name")
      .in("id", nodeSchemaNumericIds);

    for (const row of (nodeSchemaRows ?? []) as Array<{
      id: number;
      source_local_id: string;
      name: string;
    }>) {
      nodeSchemaIdToInfo.set(row.id, {
        source_local_id: row.source_local_id,
        name: row.name,
      });
      // Also populate nodeTypeIdToName if not already there
      if (!nodeTypeIdToName.has(row.source_local_id)) {
        nodeTypeIdToName.set(row.source_local_id, row.name);
      }
    }
  }

  // Build unique triplets
  const tripletSet = new Set<string>();
  const relationTriplets: RelationTriplet[] = [];

  for (const { rel, sourceConceptId, destConceptId } of matchingRelations) {
    if (!rel.schema_id) continue;

    const relTypeLocalId = relSchemaIdToLocalId.get(rel.schema_id);
    if (!relTypeLocalId) continue;

    const relInfo = relationTypeIdToInfo.get(relTypeLocalId);
    if (!relInfo) continue;

    // Resolve source node type name
    const sourceSchemaNumId = conceptIdToSchemaId.get(sourceConceptId);
    const destSchemaNumId = conceptIdToSchemaId.get(destConceptId);
    if (sourceSchemaNumId == null || destSchemaNumId == null) continue;

    const sourceSchemaInfo = nodeSchemaIdToInfo.get(sourceSchemaNumId);
    const destSchemaInfo = nodeSchemaIdToInfo.get(destSchemaNumId);
    if (!sourceSchemaInfo || !destSchemaInfo) continue;

    const sourceNodeTypeName =
      nodeTypeIdToName.get(sourceSchemaInfo.source_local_id) ??
      sourceSchemaInfo.name;
    const destNodeTypeName =
      nodeTypeIdToName.get(destSchemaInfo.source_local_id) ??
      destSchemaInfo.name;

    const tripletKey = `${sourceSchemaInfo.source_local_id}:${relTypeLocalId}:${destSchemaInfo.source_local_id}`;
    if (tripletSet.has(tripletKey)) continue;
    tripletSet.add(tripletKey);

    // Check if this triplet already exists in discourseRelations
    // We need to check using the mapped local ids (match by id first, then by name)
    const resolveLocalNodeTypeId = (
      remoteId: string,
      remoteName: string,
    ): string => {
      const byId = plugin.settings.nodeTypes.find((nt) => nt.id === remoteId);
      if (byId) return byId.id;
      const byName = plugin.settings.nodeTypes.find(
        (nt) => nt.name === remoteName,
      );
      if (byName) return byName.id;
      return remoteId;
    };

    const resolveLocalRelTypeId = (
      remoteId: string,
      remoteLabel: string,
    ): string => {
      const byId = plugin.settings.relationTypes.find(
        (rt) => rt.id === remoteId,
      );
      if (byId) return byId.id;
      const byLabel = plugin.settings.relationTypes.find(
        (rt) => rt.label === remoteLabel,
      );
      if (byLabel) return byLabel.id;
      return remoteId;
    };

    const localSourceNtId = resolveLocalNodeTypeId(
      sourceSchemaInfo.source_local_id,
      sourceNodeTypeName,
    );
    const localDestNtId = resolveLocalNodeTypeId(
      destSchemaInfo.source_local_id,
      destNodeTypeName,
    );
    const localRelTypeId = resolveLocalRelTypeId(relTypeLocalId, relInfo.label);

    const isNewTriplet = !plugin.settings.discourseRelations?.some(
      (dr) =>
        dr.sourceId === localSourceNtId &&
        dr.destinationId === localDestNtId &&
        dr.relationshipTypeId === localRelTypeId,
    );

    relationTriplets.push({
      sourceNodeTypeName,
      relationTypeLabel: relInfo.label,
      destNodeTypeName,
      isNewTriplet,
    });
  }

  return {
    selectedNodeCount: selectedNodes.length,
    newNodeTypeSchemas,
    relationInstanceCount: matchingRelations.length,
    newRelationTypeSchemas,
    relationTriplets,
    nodeKeys,
    keyToRid,
    keyToRelationEndpointId,
    relationInstancesBySpace,
  };
};
