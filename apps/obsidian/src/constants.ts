import { DiscourseNode, DiscourseRelationType, Settings } from "~/types";
import generateUid from "~/utils/generateUid";

export const DEFAULT_NODE_TYPES: Record<string, DiscourseNode> = {
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
export const DEFAULT_RELATION_TYPES: Record<string, DiscourseRelationType> = {
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
  nodeTypes: Object.values(DEFAULT_NODE_TYPES),
  relationTypes: Object.values(DEFAULT_RELATION_TYPES),
  discourseRelations: [
    {
      sourceId: DEFAULT_NODE_TYPES.Evidence!.id,
      destinationId: DEFAULT_NODE_TYPES.Question!.id,
      relationshipTypeId: DEFAULT_RELATION_TYPES.informs!.id,
    },
    {
      sourceId: DEFAULT_NODE_TYPES.Evidence!.id,
      destinationId: DEFAULT_NODE_TYPES.Claim!.id,
      relationshipTypeId: DEFAULT_RELATION_TYPES.supports!.id,
    },
    {
      sourceId: DEFAULT_NODE_TYPES.Evidence!.id,
      destinationId: DEFAULT_NODE_TYPES.Claim!.id,
      relationshipTypeId: DEFAULT_RELATION_TYPES.opposes!.id,
    },
  ],
  showIdsInFrontmatter: false,
  nodesFolderPath: "",
};
export const FRONTMATTER_KEY = "tldr-dg";
export const TLDATA_DELIMITER_START =
  "!!!_START_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!";
export const TLDATA_DELIMITER_END =
  "!!!_END_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!";

export const VIEW_TYPE_MARKDOWN = "markdown";
export const VIEW_TYPE_TLDRAW_DG_PREVIEW = "tldraw-dg-preview";

export const TLDRAW_VERSION = "3.14.1";
export const DEFAULT_SAVE_DELAY = 500; // in ms