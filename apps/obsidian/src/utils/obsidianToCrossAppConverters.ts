import type {
  CrossAppNode,
  CrossAppNodeSchema,
  CrossAppRelation,
  CrossAppRelationTripleSchema,
  CrossAppRelationTypeSchema,
} from "@repo/database/crossAppContracts";
import { extractContentFromTitle } from "@repo/database/lib/extractContentFromTitle";
import { SOURCE_SLOT } from "~/constants";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
  RelationInstance,
} from "~/types";
import type { DiscourseNodeInVault } from "./getDiscourseNodes";
import { referenceIdOf } from "./sourceSlot";
import type { ObsidianDiscourseNodeData } from "./syncDgNodesToSupabase";
import type { ChangedNodeContent } from "./upsertNodesAsContentWithEmbeddings";

export const nodeTypeToCrossApp = ({
  nodeType,
  templateContent,
  accountLocalId,
}: {
  nodeType: Pick<
    DiscourseNode,
    "id" | "name" | "format" | "template" | "created" | "modified"
  >;
  templateContent?: string;
  accountLocalId: string;
}): CrossAppNodeSchema => ({
  localId: nodeType.id,
  label: nodeType.name,
  format: nodeType.format,
  templateTitle: nodeType.template || undefined,
  template: templateContent || undefined,
  authorId: accountLocalId,
  createdAt: new Date(nodeType.created),
  modifiedAt: new Date(nodeType.modified),
});

export const relationTypeToCrossApp = ({
  relationType,
  accountLocalId,
}: {
  relationType: Pick<
    DiscourseRelationType,
    "id" | "label" | "complement" | "created" | "modified"
  >;
  accountLocalId: string;
}): CrossAppRelationTypeSchema => ({
  localId: relationType.id,
  label: relationType.label,
  complement: relationType.complement,
  authorId: accountLocalId,
  createdAt: new Date(relationType.created),
  modifiedAt: new Date(relationType.modified),
});

export const relationTripleToCrossApp = ({
  relation,
  accountLocalId,
}: {
  relation: DiscourseRelation;
  accountLocalId: string;
}): CrossAppRelationTripleSchema => ({
  localId: relation.id,
  relation: relation.relationshipTypeId,
  sourceType: relation.sourceId,
  destinationType: relation.destinationId,
  authorId: accountLocalId,
  createdAt: new Date(relation.created),
  modifiedAt: new Date(relation.modified),
});

export const nodeInstanceToCrossApp = ({
  nodeData,
  format,
  accountLocalId,
  changedContent,
}: {
  nodeData: ObsidianDiscourseNodeData;
  format?: string;
  accountLocalId: string;
  changedContent?: ChangedNodeContent;
}): CrossAppNode => {
  const title = nodeData.file.basename;
  return {
    localId: nodeData.nodeInstanceId,
    nodeType: nodeData.nodeTypeId,
    coreTitle: extractContentFromTitle(format ?? "", title),
    authorId: accountLocalId,
    createdAt: new Date(nodeData.created),
    modifiedAt: new Date(nodeData.last_modified),
    ...(nodeData.sourceDocument
      ? { slots: { [SOURCE_SLOT]: nodeData.sourceDocument } }
      : {}),
    content: {
      direct: {
        localId: nodeData.nodeInstanceId,
        value: title,
        ...(changedContent?.titleEmbedding
          ? { embedding: { value: changedContent.titleEmbedding } }
          : {}),
      },
      ...(changedContent?.fullText !== undefined
        ? {
            full: {
              localId: nodeData.nodeInstanceId,
              value: changedContent.fullText,
              contentType: "text/obsidian+markdown",
            },
          }
        : {}),
    },
  };
};

export const relationInstanceToCrossApp = ({
  relation,
  sourceNode,
  destinationNode,
  accountLocalId,
}: {
  relation: RelationInstance;
  sourceNode: DiscourseNodeInVault;
  destinationNode: DiscourseNodeInVault;
  accountLocalId: string;
}): CrossAppRelation => ({
  localId: relation.id,
  relationType: relation.type,
  source: referenceIdOf(sourceNode),
  destination: referenceIdOf(destinationNode),
  authorId: accountLocalId,
  createdAt: new Date(relation.created),
  modifiedAt: new Date(relation.lastModified ?? relation.created),
});
