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
import type { ChangedNodeContent } from "./upsertNodesAsContentWithEmbeddings";
import {
  crossAppNodeSchemaToDbConcept,
  crossAppNodeToDbConcept,
  crossAppRelationTripleSchemaToDbConcept,
  crossAppRelationTypeSchemaToDbConcept,
} from "@repo/database/lib/crossAppConverters";
import {
  nodeInstanceToCrossApp,
  nodeTypeToCrossApp,
  relationTripleToCrossApp,
  relationTypeToCrossApp,
} from "./obsidianToCrossAppConverters";

// The shared converters build each row from its CrossApp type. The values set
// after them have no CrossApp field, so each one needs a field, or has to stop
// being stored, before sync can send CrossApp objects instead of rows.
export const discourseNodeSchemaToLocalConcept = ({
  accountLocalId,
  node,
  templateContent,
}: {
  accountLocalId: string;
  node: DiscourseNode;
  templateContent?: string;
}): LocalConceptDataInput => {
  const {
    description,
    template,
    id,
    name,
    format,
    created,
    modified,
    importedFromRid,
    ...otherData
  } = node;
  const concept = crossAppNodeSchemaToDbConcept(
    nodeTypeToCrossApp({
      nodeType: { id, name, format, template, created, modified },
      templateContent,
      accountLocalId,
    }),
  );
  return {
    ...concept,
    description,
    literal_content: {
      ...(concept.literal_content as Record<string, Json>),
      ...(templateContent ? {} : { template_content: null }),
      source_data: otherData,
      ...(importedFromRid ? { importedFromRid } : {}),
    },
  };
};

export const discourseRelationTypeToLocalConcept = ({
  accountLocalId,
  relationType,
}: {
  accountLocalId: string;
  relationType: DiscourseRelationType;
}): LocalConceptDataInput => {
  const {
    id,
    label,
    complement,
    created,
    modified,
    importedFromRid,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exclude status from database upload
    status, //destructuring status to not upload it to the database
    ...otherData
  } = relationType;
  const concept = crossAppRelationTypeSchemaToDbConcept(
    relationTypeToCrossApp({
      relationType: { id, label, complement, created, modified },
      accountLocalId,
    }),
  );
  return {
    ...concept,
    literal_content: {
      ...(concept.literal_content as Record<string, Json>),
      source_data: otherData,
      ...(importedFromRid ? { importedFromRid } : {}),
    },
  };
};

export const discourseRelationTripleSchemaToLocalConcept = ({
  accountLocalId,
  relation,
  nodeTypesById,
  relationTypesById,
}: {
  accountLocalId: string;
  relation: DiscourseRelation;
  nodeTypesById: Record<string, DiscourseNode>;
  relationTypesById: Record<string, DiscourseRelationType>;
}): LocalConceptDataInput | null => {
  const { relationshipTypeId, sourceId, destinationId, importedFromRid } =
    relation;
  const sourceName = nodeTypesById[sourceId]?.name ?? sourceId;
  const destinationName = nodeTypesById[destinationId]?.name ?? destinationId;
  const relationType = relationTypesById[relationshipTypeId];
  if (!relationType) return null;
  const concept = crossAppRelationTripleSchemaToDbConcept(
    relationTripleToCrossApp({ relation, accountLocalId }),
    relationTypeToCrossApp({ relationType, accountLocalId }),
  );
  if (concept === undefined) return null;
  return {
    ...concept,
    name: `${sourceName} -${relationType.label}-> ${destinationName}`,
    literal_content: {
      ...(concept.literal_content as Record<string, Json>),
      ...(importedFromRid ? { importedFromRid } : {}),
    },
  };
};

/**
 * Convert discourse node instance (file) to LocalConceptDataInput
 */
export const discourseNodeInstanceToLocalConcept = ({
  accountLocalId,
  nodeData,
  nodeTypesById,
  changedContent,
}: {
  accountLocalId: string;
  nodeData: ObsidianDiscourseNodeData;
  nodeTypesById: Record<string, DiscourseNode>;
  changedContent?: ChangedNodeContent;
}): LocalConceptDataInput => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- exclude the ids from source_data
  const { nodeInstanceId, nodeTypeId, ...otherData } = nodeData.frontmatter;
  const { contents_inline: convertedContents = [], ...concept } =
    crossAppNodeToDbConcept(
      nodeInstanceToCrossApp({
        nodeData,
        format: nodeTypesById[nodeData.nodeTypeId]?.format,
        accountLocalId,
        changedContent,
      }),
    );
  const contents = convertedContents
    .filter(
      (content) =>
        content.variant !== "direct" || nodeData.changeTypes.includes("title"),
    )
    .map((content) => ({
      ...content,
      creator_local_id: accountLocalId,
      metadata:
        content.variant === "direct"
          ? { filePath: nodeData.file.path }
          : (nodeData.frontmatter as Json),
    }));
  return {
    ...concept,
    name: nodeData.file.path,
    literal_content: {
      ...(concept.literal_content as Record<string, Json>),
      label: nodeData.file.basename,
      source_data: otherData as unknown as Json,
    },
    ...(contents.length > 0 ? { contents_inline: contents } : {}),
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
  if (sourceNode === undefined || destinationNode === undefined) {
    console.error("Cannot find the nodes");
    return null;
  }

  const literal_content: Record<string, Json> = {};
  if (importedFromRid) literal_content.importedFromRid = importedFromRid;
  return {
    space_id: context.spaceId,
    name: `[[${sourceNode.file.basename}]] -${relationType.label}-> [[${destinationNode.file.basename}]]`,
    source_local_id: relationInstanceData.id,
    author_id: relationInstanceData.authorId ?? context.userId,
    schema_represented_by_local_id: type,
    is_schema: false,
    created: new Date(created).toISOString(),
    last_modified: new Date(lastModified ?? created).toISOString(),
    literal_content,
    local_reference_content: {
      source:
        (sourceNode.frontmatter.importedFromRid as string | undefined) ??
        source,
      destination:
        (destinationNode.frontmatter.importedFromRid as string | undefined) ??
        destination,
    },
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
const orderConceptsRec = ({
  ordered,
  concept,
  remainder,
  processed,
}: {
  ordered: LocalConceptDataInput[];
  concept: LocalConceptDataInput;
  remainder: { [key: string]: LocalConceptDataInput };
  processed: Set<string>;
}): Set<string> => {
  // Add to processed at the start to prevent cycles
  processed.add(concept.source_local_id!);
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
        ...orderConceptsRec({
          ordered,
          concept: relatedConcept,
          remainder,
          processed,
        }),
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
  const processed: Set<string> = new Set();
  while (Object.keys(conceptById).length > 0) {
    const first = Object.values(conceptById)[0];
    if (!first) break;
    missing = new Set([
      ...missing,
      ...orderConceptsRec({
        ordered,
        concept: first,
        remainder: conceptById,
        processed,
      }),
    ]);
    if (missing.size > 0) console.error(`missing: ${[...missing].join(", ")}`);
  }
  return { ordered, missing: Array.from(missing) };
};
