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
  },
  Evidence: {
    id: generateUid("node"),
    name: "Evidence",
    format: "EVD - {content}",
    color: "#DB134A",
  },
};
export const DEFAULT_RELATION_TYPES: Record<string, DiscourseRelationType> = {
  supports: {
    id: generateUid("relation"),
    label: "supports",
    complement: "is supported by",
    color: "green",
  },
  opposes: {
    id: generateUid("relation"),
    label: "opposes",
    complement: "is opposed by",
    color: "red",
  },
  informs: {
    id: generateUid("relation"),
    label: "informs",
    complement: "is informed by",
    color: "blue",
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

export const TLDRAW_VERSION = "3.14.1";
export const DEFAULT_SAVE_DELAY = 500; // in ms
export const WHITE_LOGO_SVG =
  '<svg width="18" height="18" viewBox="0 0 256 264" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M156.705 252.012C140.72 267.995 114.803 267.995 98.8183 252.012L11.9887 165.182C-3.99622 149.197 -3.99622 123.28 11.9886 107.296L55.4035 63.8807C63.3959 55.8881 76.3541 55.8881 84.3467 63.8807C92.3391 71.8731 92.3391 84.8313 84.3467 92.8239L69.8751 107.296C53.8901 123.28 53.8901 149.197 69.8751 165.182L113.29 208.596C121.282 216.589 134.241 216.589 142.233 208.596C150.225 200.604 150.225 187.646 142.233 179.653L127.761 165.182C111.777 149.197 111.777 123.28 127.761 107.296C143.746 91.3105 143.746 65.3939 127.761 49.4091L113.29 34.9375C105.297 26.9452 105.297 13.9868 113.29 5.99432C121.282 -1.99811 134.241 -1.99811 142.233 5.99434L243.533 107.296C259.519 123.28 259.519 149.197 243.533 165.182L156.705 252.012ZM200.119 121.767C192.127 113.775 179.168 113.775 171.176 121.767C163.184 129.76 163.184 142.718 171.176 150.71C179.168 158.703 192.127 158.703 200.119 150.71C208.112 142.718 208.112 129.76 200.119 121.767Z" fill="currentColor"/></svg>';