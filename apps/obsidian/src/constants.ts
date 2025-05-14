import { DiscourseNode, DiscourseRelationType, Settings } from "./types";
import generateUid from "./utils/generateUid";

export const defaultNodeTypes: Record<string, DiscourseNode> = {
  Question: {
    id: generateUid("node"),
    name: "Question",
    format: "QUE - {content}",
  },
  Claim: {
    id: generateUid("node"),
    name: "Claim",
    format: "CLM - {content}",
  },
  Evidence: {
    id: generateUid("node"),
    name: "Evidence",
    format: "EVD - {content}",
  },
};
export const defaultRelationTypes: Record<string, DiscourseRelationType> = {
  supports: {
    id: generateUid("relation"),
    label: "supports",
    complement: "is supported by",
  },
  opposes: {
    id: generateUid("relation"),
    label: "opposes",
    complement: "is opposed by",
  },
  informs: {
    id: generateUid("relation"),
    label: "informs",
    complement: "is informed by",
  },
};

export const DEFAULT_SETTINGS: Settings = {
  nodeTypes: Object.values(defaultNodeTypes),
  relationTypes: Object.values(defaultRelationTypes),
  discourseRelations: [
    {
      sourceId: defaultNodeTypes.Question!.id,
      destinationId: defaultNodeTypes.Evidence!.id,
      relationshipTypeId: defaultRelationTypes.supports!.id,
    },
    {
      sourceId: defaultNodeTypes.Claim!.id,
      destinationId: defaultNodeTypes.Evidence!.id,
      relationshipTypeId: defaultRelationTypes.opposes!.id,
    },
    {
      sourceId: defaultNodeTypes.Claim!.id,
      destinationId: defaultNodeTypes.Evidence!.id,
      relationshipTypeId: defaultRelationTypes.informs!.id,
    },
  ],
};
