/* eslint-disable @typescript-eslint/naming-convention */
import type { TFile } from "obsidian";
import type { DiscourseNode } from "~/types";
import type { SupabaseContext } from "./supabaseContext";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type { ObsidianDiscourseNodeData } from "./syncDgNodesToSupabase";
import type { Json } from "@repo/database/dbTypes";
import DiscourseGraphPlugin from "..";

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
    name,
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

/**
 * Convert discourse node instance (file) to LocalConceptDataInput
 */
export const discourseNodeInstanceToLocalConcept = ({
  context,
  nodeData,
  accountLocalId,
}: {
  context: SupabaseContext;
  nodeData: ObsidianDiscourseNodeData;
  accountLocalId: string;
}): LocalConceptDataInput => {
  const extraData = getNodeExtraData(nodeData.file, accountLocalId);
  const { nodeInstanceId, nodeTypeId, ...otherData } = nodeData.frontmatter;
  return {
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
  };
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
 * Recursively order concepts by dependency so that dependents (e.g. instances)
 * come after their dependencies (e.g. schemas). When we look up a related
 * concept by id in `remainder`, we use the same id that appears in
 * schema_represented_by_local_id or local_reference_content — so that id
 * must equal some concept's source_local_id or it is reported as "missing".
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

/**
 * Order concepts so dependencies (schemas) are before dependents (instances).
 * Assumes every concept has source_local_id; concepts without it are excluded
 * from the map (same as Roam). A node type is "missing" when an instance
 * references schema_represented_by_local_id = X but no concept in the input
 * has source_local_id === X (e.g. schema not included, or id vs nodeTypeId mismatch).
 */
export const orderConceptsByDependency = (
  concepts: LocalConceptDataInput[],
): { ordered: LocalConceptDataInput[]; missing: string[] } => {
  if (concepts.length === 0) return { ordered: concepts, missing: [] };
  const conceptById: { [key: string]: LocalConceptDataInput } =
    Object.fromEntries(
      concepts
        .filter((c) => c.source_local_id != null && c.source_local_id !== "")
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
