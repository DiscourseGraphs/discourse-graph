import type { TFile } from "obsidian";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
  RelationInstance,
} from "~/types";
import type { SupabaseContext } from "./supabaseContext";
import type { DiscourseNodeInVault } from "./getDiscourseNodes";
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
  /* eslint-disable @typescript-eslint/naming-convention */
  author_local_id: string;
  created: string;
  last_modified: string;
} => {
  return {
    author_local_id: accountLocalId,
    created: new Date(file.stat.ctime).toISOString(),
    last_modified: new Date(file.stat.mtime).toISOString(),
  };
  /* eslint-enable @typescript-eslint/naming-convention */
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
  const {
    description,
    template,
    id,
    name,
    created,
    modified,
    importedFromRid,
    ...otherData
  } = node;
  /* eslint-disable @typescript-eslint/naming-convention */
  const literal_content: Record<string, Json> = {
    label: name,
    source_data: otherData,
  };
  if (template) literal_content.template = template;
  if (importedFromRid) literal_content.importedFromRid = importedFromRid;
  return {
    space_id: context.spaceId,
    name,
    source_local_id: id,
    is_schema: true,
    author_local_id: accountLocalId,
    created: new Date(created).toISOString(),
    last_modified: new Date(modified).toISOString(),
    description: description,
    literal_content,
    /* eslint-enable @typescript-eslint/naming-convention */
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
  const {
    id,
    label,
    complement,
    created,
    modified,
    importedFromRid,
    ...otherData
  } = relationType;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const literal_content: Record<string, Json> = {
    roles: STANDARD_ROLES,
    label,
    complement,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    source_data: otherData,
  };
  if (importedFromRid) literal_content.importedFromRid = importedFromRid;

  return {
    /* eslint-disable @typescript-eslint/naming-convention */
    space_id: context.spaceId,
    name: label,
    source_local_id: id,
    is_schema: true,
    author_local_id: accountLocalId,
    created: new Date(created).toISOString(),
    last_modified: new Date(modified).toISOString(),
    literal_content,
    /* eslint-enable @typescript-eslint/naming-convention */
  };
};

export const discourseRelationTripleSchemaToLocalConcept = ({
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
  const {
    id,
    relationshipTypeId,
    sourceId,
    destinationId,
    created,
    modified,
    importedFromRid,
  } = relation;
  const sourceName = nodeTypesById[sourceId]?.name ?? sourceId;
  const destinationName = nodeTypesById[destinationId]?.name ?? destinationId;
  const relationType = relationTypesById[relationshipTypeId];
  if (!relationType)
    throw new Error(`missing relation type ${relationshipTypeId}`);
  const { label, complement } = relationType;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const literal_content: Record<string, Json> = {
    roles: STANDARD_ROLES,
    label,
    complement,
  };
  if (importedFromRid) literal_content.importedFromRid = importedFromRid;

  return {
    /* eslint-disable @typescript-eslint/naming-convention */
    space_id: context.spaceId,
    name: `${sourceName} -${label}-> ${destinationName}`,
    source_local_id: id,
    is_schema: true,
    author_local_id: accountLocalId,
    created: new Date(created).toISOString(),
    last_modified: new Date(modified).toISOString(),
    literal_content,
    local_reference_content: {
      relation_type: relationshipTypeId,
      source: sourceId,
      destination: destinationId,
    },
    /* eslint-enable @typescript-eslint/naming-convention */
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
  const { nodeInstanceId, nodeTypeId, importedFromRid, ...otherData } =
    nodeData.frontmatter;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const literal_content: Record<string, Json> = {
    label: nodeData.file.basename,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    source_data: otherData as unknown as Json,
  };
  if (importedFromRid && typeof importedFromRid === "string")
    literal_content.importedFromRid = importedFromRid;
  return {
    /* eslint-disable @typescript-eslint/naming-convention */
    space_id: context.spaceId,
    name: nodeData.file.path,
    source_local_id: nodeInstanceId as string,
    schema_represented_by_local_id: nodeTypeId as string,
    is_schema: false,
    literal_content,
    /* eslint-enable @typescript-eslint/naming-convention */
    ...extraData,
  };
};

export const relationInstanceToLocalConcept = ({
  context,
  relationTypesById,
  allNodesById,
  relationInstanceData,
}: {
  context: SupabaseContext;
  relationTypesById: Record<string, DiscourseRelationType>;
  allNodesById: Record<string, DiscourseNodeInVault>;
  relationInstanceData: RelationInstance;
}): LocalConceptDataInput | null => {
  const { type, created, lastModified, source, destination, importedFromRid } =
    relationInstanceData;
  const relationType = relationTypesById[type];

  if (!relationType) {
    console.error("Missing relationType id " + type);
    return null;
  }
  const sourceNode = allNodesById[source];
  const destinationNode = allNodesById[destination];
  if (
    sourceNode?.frontmatter.importedFromRid ||
    destinationNode?.frontmatter.importedFromRid
  )
    return null; // punt relation to imported nodes for now.
  // otherwise put the importedFromRid in source, dest.

  /* eslint-disable @typescript-eslint/naming-convention */
  const literal_content: Record<string, Json> = {};
  if (importedFromRid) literal_content.importedFromRid = importedFromRid;
  return {
    space_id: context.spaceId,
    name: `[[${sourceNode ? sourceNode.file.basename : source}]] -${relationType.label}-> [[${destinationNode ? destinationNode.file.basename : destination}]]`,
    source_local_id: relationInstanceData.id,
    author_local_id: relationInstanceData.author,
    schema_represented_by_local_id: type,
    is_schema: false,
    created: new Date(created).toISOString(),
    last_modified: new Date(lastModified ?? created).toISOString(),
    literal_content,
    local_reference_content: {
      source,
      destination,
    },
    /* eslint-enable @typescript-eslint/naming-convention */
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
  processed: Set<string>,
): Set<string> => {
  const relatedConceptIds = relatedConcepts(concept);
  let missing: Set<string> = new Set();
  while (relatedConceptIds.length > 0) {
    const relatedConceptId = relatedConceptIds.shift()!;
    if (processed.has(relatedConceptId)) continue;
    const relatedConcept = remainder[relatedConceptId];
    if (relatedConcept === undefined) {
      missing.add(relatedConceptId);
    } else {
      missing = new Set([
        ...missing,
        ...orderConceptsRec(ordered, relatedConcept, remainder, processed),
      ]);
      delete remainder[relatedConceptId];
    }
  }
  ordered.push(concept);
  processed.add(concept.source_local_id!);
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
  const processed: Set<string> = new Set();
  while (Object.keys(conceptById).length > 0) {
    const first = Object.values(conceptById)[0];
    if (!first) break;
    missing = new Set([
      ...missing,
      ...orderConceptsRec(ordered, first, conceptById, processed),
    ]);
    if (missing.size > 0) console.error(`missing: ${[...missing].join(", ")}`);
  }
  return { ordered, missing: Array.from(missing) };
};
