import { TLDefaultSizeStyle } from "tldraw";
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
    tag: "clm-candidate",
  },
  Evidence: {
    id: generateUid("node"),
    name: "Evidence",
    format: "EVD - {content}",
    color: "#DB134A",
    tag: "evd-candidate",
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
  nodeTagHotkey: "\\",
  spacePassword: undefined,
  accountLocalId: undefined,
  syncModeEnabled: false,
};

export const FEATURE_FLAGS = {
  // settings for these features are in the Admin Panel (hidden tab in Settings, toggle with Ctrl+Shift+A)
  DATABASE_SYNC: "databaseSync",
} as const;

export type FeatureFlagKey = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];
export const FRONTMATTER_KEY = "tldr-dg";
export const TLDATA_DELIMITER_START =
  "!!!_START_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!";
export const TLDATA_DELIMITER_END =
  "!!!_END_OF_TLDRAW_DG_DATA__DO_NOT_CHANGE_THIS_PHRASE_!!!";

export const VIEW_TYPE_MARKDOWN = "markdown";
export const VIEW_TYPE_TLDRAW_DG_PREVIEW = "tldraw-dg-preview";

export const TLDRAW_VERSION = "3.14.2";
export const DEFAULT_SAVE_DELAY = 500; // in ms

// TODO REPLACE WITH TLDRAW DEFAULTS
// https://github.com/tldraw/tldraw/pull/1580/files
export const TEXT_PROPS = {
  lineHeight: 1.35,
  fontWeight: "normal",
  fontVariant: "normal",
  fontStyle: "normal",
  padding: "0px",
  maxWidth: "auto",
};
export const FONT_SIZES: Record<TLDefaultSizeStyle, number> = {
  m: 25,
  l: 38,
  xl: 48,
  s: 16,
};
// // FONT_FAMILIES.sans or tldraw_sans not working in toSvg()
// // maybe check getSvg()
// // in node_modules\@tldraw\tldraw\node_modules\@tldraw\editor\dist\cjs\lib\app\App.js
// const SVG_FONT_FAMILY = `"Inter", "sans-serif"`;

export const DEFAULT_STYLE_PROPS = {
  ...TEXT_PROPS,
  fontSize: 16,
  fontFamily: "'Inter', sans-serif",
  width: "fit-content",
  padding: "40px",
};
