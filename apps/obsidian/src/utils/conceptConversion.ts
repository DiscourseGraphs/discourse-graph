/* eslint-disable @typescript-eslint/naming-convention */
import type { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";
import type { SupabaseContext } from "./supabaseContext";
import type { DiscourseNodeInVault } from "./syncDgNodesToSupabase";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type { ObsidianDiscourseNodeData } from "./syncDgNodesToSupabase";
import type { Json } from "@repo/database/dbTypes";

/**
 * Get extra data (author, timestamps) from file metadata
 */
const getNodeExtraData = (
  file: TFile,
  accountLocalId: string,
): {
  author_local_id: string;
  created: string;
  last_modified: string;
} => {
  return {
    author_local_id: accountLocalId,
    created: new Date(file.stat.ctime).toISOString(),
    last_modified: new Date(file.stat.mtime).toISOString(),
  };
};

export const discourseNodeSchemaToLocalConcept = ({
  context,
  node,
  accountLocalId,
}: {
  context: SupabaseContext;
  node: DiscourseNode;
  accountLocalId: string;
}): LocalConceptDataInput => {
  const { description, template, id, name, created, modified, ...otherData } =
    node;
  return {
    space_id: context.spaceId,
    name: name,
    source_local_id: id,
    is_schema: true,
    author_local_id: accountLocalId,
    created: new Date(created).toISOString(),
    last_modified: new Date(modified).toISOString(),
    description: description,
    literal_content: {
      label: name,
      template: template,
      source_data: otherData,
    },
  };
};

const STANDARD_ROLES = ["source", "destination"];

export const discourseRelationTypeToLocalConcept = ({
  context,
  relationType,
  accountLocalId,
}: {
  context: SupabaseContext;
  relationType: DiscourseRelationType;
  accountLocalId: string;
}): LocalConceptDataInput => {
  const { id, label, complement, created, modified, ...otherData } =
    relationType;
  return {
    space_id: context.spaceId,
    name: label,
    source_local_id: id,
    is_schema: true,
    author_local_id: accountLocalId,
    created: new Date(created).toISOString(),
    last_modified: new Date(modified).toISOString(),
    literal_content: {
      label,
      complement,
      source_data: otherData,
    } as unknown as Json,
  };
};

export const discourseRelationSchemaToLocalConcept = ({
  context,
  relation,
  accountLocalId,
  nodeTypesById,
  relationTypesById,
}: {
  context: SupabaseContext;
  relation: DiscourseRelation;
  accountLocalId: string;
  nodeTypesById: Record<string, DiscourseNode>;
  relationTypesById: Record<string, DiscourseRelationType>;
}): LocalConceptDataInput => {
  const { id, relationshipTypeId, sourceId, destinationId, created, modified } =
    relation;
  const sourceName = nodeTypesById[sourceId]?.name ?? sourceId;
  const destinationName = nodeTypesById[destinationId]?.name ?? destinationId;
  const relationType = relationTypesById[relationshipTypeId];
  if (!relationType)
    throw new Error(`missing relation type ${relationshipTypeId}`);
  const { label, complement } = relationType;

  return {
    space_id: context.spaceId,
    name: `${sourceName} -${label}-> ${destinationName}`,
    source_local_id: id,
    is_schema: true,
    author_local_id: accountLocalId,
    created: new Date(created).toISOString(),
    last_modified: new Date(modified).toISOString(),
    literal_content: {
      roles: STANDARD_ROLES,
      label,
      complement,
    },
    local_reference_content: {
      relation_type: relationshipTypeId,
      source: sourceId,
      destination: destinationId,
    },
  };
};

/**
 * Convert discourse node instance (file) to LocalConceptDataInput
 */
export const discourseNodeInstanceToLocalConcepts = ({
  plugin,
  allNodesByName,
  context,
  nodeData,
  accountLocalId,
}: {
  plugin: DiscourseGraphPlugin;
  allNodesByName: Record<string, DiscourseNodeInVault>;
  context: SupabaseContext;
  nodeData: ObsidianDiscourseNodeData;
  accountLocalId: string;
}): LocalConceptDataInput[] => {
  const extraData = getNodeExtraData(nodeData.file, accountLocalId);
  const { nodeInstanceId, nodeTypeId, ...otherData } = nodeData.frontmatter;
  const response: LocalConceptDataInput[] = [];
  for (const relType of plugin.settings.relationTypes) {
    const rels = otherData[relType.id];
    if (rels) {
      delete otherData[relType.id];
      const triples = plugin.settings.discourseRelations.filter(
        (r) => r.relationshipTypeId === relType.id && r.sourceId === nodeTypeId,
      );
      if (!triples.length) {
        // we're probably the target.
        continue;
      }
      const tripleIdByDestType = Object.fromEntries(
        triples.map((rel) => [rel.destinationId, rel.id]),
      );
      for (let rel of rels as string[]) {
        if (rel.startsWith("[[") && rel.endsWith("]]"))
          rel = rel.substring(2, rel.length - 2);
        if (rel.endsWith(".md")) rel = rel.substring(0, rel.length - 3);
        const target = allNodesByName[rel];
        if (!target) {
          console.error(`Could not find node name ${rel}`);
          continue;
        }
        const targetTypeId = target.frontmatter.nodeTypeId as string;
        const targetInstanceId = target.frontmatter.nodeInstanceId as string;
        const relSchemaId = tripleIdByDestType[targetTypeId];
        if (relSchemaId === undefined) {
          console.error(
            `Found a relation of type ${relType.id} between ${nodeData.file.path} and ${rel} but no relation fits`,
          );
          continue;
        }
        const compositeInstanceId = [
          relSchemaId,
          nodeInstanceId as string,
          targetInstanceId,
        ].join(":");
        response.push({
          space_id: context.spaceId,
          name: `[[${nodeData.file.basename}]] -${relType.label}-> [[${target.file.basename}]]`,
          source_local_id: compositeInstanceId,
          schema_represented_by_local_id: relSchemaId,
          is_schema: false,
          local_reference_content: {
            source: nodeInstanceId as string,
            destination: targetInstanceId,
          },
          ...extraData,
        });
      }
    }
  }
  response.push({
    space_id: context.spaceId,
    name: nodeData.file.path,
    source_local_id: nodeInstanceId as string,
    schema_represented_by_local_id: nodeTypeId as string,
    is_schema: false,
    literal_content: {
      label: nodeData.file.basename,
      source_data: otherData as unknown as Json,
    },
    ...extraData,
  });
  return response;
};

export const relatedConcepts = (concept: LocalConceptDataInput): string[] => {
  const relations = Object.values(
    concept.local_reference_content || {},
  ).flat() as string[];
  if (concept.schema_represented_by_local_id) {
    relations.push(concept.schema_represented_by_local_id);
  }
  // remove duplicates
  return [...new Set(relations)];
};

/**
 * Recursively order concepts by dependency
 */
const orderConceptsRec = (
  ordered: LocalConceptDataInput[],
  concept: LocalConceptDataInput,
  remainder: { [key: string]: LocalConceptDataInput },
): Set<string> => {
  const relatedConceptIds = relatedConcepts(concept);
  let missing: Set<string> = new Set();
  while (relatedConceptIds.length > 0) {
    const relatedConceptId = relatedConceptIds.shift()!;
    const relatedConcept = remainder[relatedConceptId];
    if (relatedConcept === undefined) {
      missing.add(relatedConceptId);
    } else {
      missing = new Set([
        ...missing,
        ...orderConceptsRec(ordered, relatedConcept, remainder),
      ]);
      delete remainder[relatedConceptId];
    }
  }
  ordered.push(concept);
  delete remainder[concept.source_local_id!];
  return missing;
};

export const orderConceptsByDependency = (
  concepts: LocalConceptDataInput[],
): { ordered: LocalConceptDataInput[]; missing: string[] } => {
  if (concepts.length === 0) return { ordered: concepts, missing: [] };
  const conceptById: { [key: string]: LocalConceptDataInput } =
    Object.fromEntries(
      concepts
        .filter((c) => c.source_local_id)
        .map((c) => [c.source_local_id!, c]),
    );
  const ordered: LocalConceptDataInput[] = [];
  let missing: Set<string> = new Set();
  while (Object.keys(conceptById).length > 0) {
    const first = Object.values(conceptById)[0];
    if (!first) break;
    missing = new Set([
      ...missing,
      ...orderConceptsRec(ordered, first, conceptById),
    ]);
    if (missing.size > 0) console.error(`missing: ${[...missing]}`);
  }
  return { ordered, missing: Array.from(missing) };
};
