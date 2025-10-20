import { DiscourseNode, DiscourseRelationType, Settings } from "~/types";
import generateUid from "~/utils/generateUid";

export const DEFAULT_NODE_TYPES: Record<string, DiscourseNode> = {
  Question: {
    id: generateUid("node"),
    name: "Question",
    format: "QUE - {content}",
    color: "#99890e",
  },
  Claim: {
    id: generateUid("node"),
    name: "Claim",
    format: "CLM - {content}",
    color: "#7DA13E",
    tag: "#clm-candidate",
  },
  Evidence: {
    id: generateUid("node"),
    name: "Evidence",
    format: "EVD - {content}",
    color: "#DB134A",
    tag: "#evd-candidate",
  },
};
export const DEFAULT_RELATION_TYPES: Record<string, DiscourseRelationType> = {
  supports: {
    id: generateUid("relation"),
    label: "supports",
    complement: "is supported by",
    color: "#099268",
  },
  opposes: {
    id: generateUid("relation"),
    label: "opposes",
    complement: "is opposed by",
    color: "#e03131",
  },
  informs: {
    id: generateUid("relation"),
    label: "informs",
    complement: "is informed by",
    color: "#adb5bd",
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
  canvasFolderPath: "Discourse Canvas",
  canvasAttachmentsFolderPath: "attachments",
};
export const FRONTMATTER_KEY = "tldr-dg";
export const TLDATA_DELIMITER_START =
  "!!!_START_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!";
export const TLDATA_DELIMITER_END =
  "!!!_END_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!";

export const VIEW_TYPE_MARKDOWN = "markdown";
export const VIEW_TYPE_TLDRAW_DG_PREVIEW = "tldraw-dg-preview";

export const TLDRAW_VERSION = "3.14.2";
export const DEFAULT_SAVE_DELAY = 500; // in ms