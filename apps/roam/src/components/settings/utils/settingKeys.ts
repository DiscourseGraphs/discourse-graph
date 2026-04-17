import type {
  PersonalSettings,
  QuerySettings,
  GlobalSettings,
  ExportSettings,
  SuggestiveModeGlobalSettings,
  LeftSidebarGlobalSettings,
  DiscourseNodeSettings,
  CanvasSettings,
  SuggestiveRules,
} from "./zodSchema";

export const PERSONAL_KEYS = {
  discourseContextOverlay: "Discourse context overlay",
  textSelectionPopup: "Text selection popup",
  disableSidebarOpen: "Disable sidebar open",
  pagePreview: "Page preview",
  hideFeedbackButton: "Hide feedback button",
  autoCanvasRelations: "Auto canvas relations",
  overlayInCanvas: "Overlay in canvas",
  streamlineStyling: "Streamline styling",
  disableProductDiagnostics: "Disable product diagnostics",
  discourseToolShortcut: "Discourse tool shortcut",
  personalNodeMenuTrigger: "Personal node menu trigger",
  nodeSearchMenuTrigger: "Node search menu trigger",
  leftSidebar: "Left sidebar",
  query: "Query",
} as const satisfies Record<string, keyof PersonalSettings>;

export const QUERY_KEYS = {
  hideQueryMetadata: "Hide query metadata",
  defaultPageSize: "Default page size",
  queryPages: "Query pages",
  defaultFilters: "Default filters",
} as const satisfies Record<string, keyof QuerySettings>;

export const GLOBAL_KEYS = {
  trigger: "Trigger",
  canvasPageFormat: "Canvas page format",
  leftSidebar: "Left sidebar",
  export: "Export",
  suggestiveMode: "Suggestive mode",
  relations: "Relations",
} as const satisfies Record<string, keyof GlobalSettings>;

export const SUGGESTIVE_MODE_KEYS = {
  includeCurrentPageRelations: "Include current page relations",
  includeParentAndChildBlocks: "Include parent and child blocks",
  pageGroups: "Page groups",
} as const satisfies Record<string, keyof SuggestiveModeGlobalSettings>;

export const LEFT_SIDEBAR_KEYS = {
  children: "Children",
  settings: "Settings",
} as const satisfies Record<string, keyof LeftSidebarGlobalSettings>;

export const EXPORT_KEYS = {
  removeSpecialCharacters: "Remove special characters",
  resolveBlockReferences: "Resolve block references",
  resolveBlockEmbeds: "Resolve block embeds",
  appendReferencedNode: "Append referenced node",
  linkType: "Link type",
  maxFilenameLength: "Max filename length",
  frontmatter: "Frontmatter",
} as const satisfies Record<string, keyof ExportSettings>;

export const LEFT_SIDEBAR_SETTINGS_KEYS = {
  collapsable: "Collapsable",
  folded: "Folded",
} as const satisfies Record<
  string,
  keyof LeftSidebarGlobalSettings["Settings"]
>;

export const DISCOURSE_NODE_KEYS = {
  canvasSettings: "canvasSettings",
  overlay: "overlay",
  attributes: "attributes",
  specification: "specification",
  index: "index",
  description: "description",
  shortcut: "shortcut",
  tag: "tag",
  format: "format",
  graphOverview: "graphOverview",
  suggestiveRules: "suggestiveRules",
} as const satisfies Record<string, keyof DiscourseNodeSettings>;

export const SUGGESTIVE_RULES_KEYS = {
  embeddingRef: "embeddingRef",
  isFirstChild: "isFirstChild",
} as const satisfies Record<string, keyof SuggestiveRules>;

export const CANVAS_KEYS = {
  color: "color",
  alias: "alias",
  keyImage: "key-image",
  keyImageOption: "key-image-option",
  queryBuilderAlias: "query-builder-alias",
} as const satisfies Record<string, keyof CanvasSettings>;

export const SPECIFICATION_KEYS = {
  enabled: "enabled",
  query: "query",
} as const satisfies Record<
  string,
  keyof DiscourseNodeSettings["specification"]
>;

export const TEMPLATE_SETTING_KEYS: (keyof DiscourseNodeSettings)[] = [
  "template",
];
