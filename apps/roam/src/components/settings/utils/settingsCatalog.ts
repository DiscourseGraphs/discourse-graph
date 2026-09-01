import getDiscourseNodes, {
  excludeDefaultNodes,
} from "~/utils/getDiscourseNodes";
import { isSyncEnabled } from "./accessors";
import { rootPath, type SettingsPath } from "./settingsNavigation";
import { SETTINGS_TAB_IDS, SETTINGS_TAB_META } from "./settingsTabs";
import {
  CANVAS_KEYS,
  DISCOURSE_NODE_KEYS,
  EXPORT_KEYS,
  FEATURE_FLAG_KEYS,
  GLOBAL_KEYS,
  LEFT_SIDEBAR_KEYS,
  PERSONAL_KEYS,
  QUERY_KEYS,
  SPECIFICATION_KEYS,
  SUGGESTIVE_MODE_KEYS,
  SUGGESTIVE_RULES_KEYS,
} from "./settingKeys";
import { ROAM_DOCS } from "./docs";

/** Every settings key, addressed as `GROUP.member`, so the key list is never restated. */
const SETTING_KEY_GROUPS = {
  CANVAS_KEYS,
  DISCOURSE_NODE_KEYS,
  EXPORT_KEYS,
  FEATURE_FLAG_KEYS,
  GLOBAL_KEYS,
  LEFT_SIDEBAR_KEYS,
  PERSONAL_KEYS,
  QUERY_KEYS,
  SPECIFICATION_KEYS,
  SUGGESTIVE_MODE_KEYS,
  SUGGESTIVE_RULES_KEYS,
} as const;

type SettingKeyGroups = typeof SETTING_KEY_GROUPS;

export type SettingKeyId = {
  [G in keyof SettingKeyGroups]: `${G & string}.${keyof SettingKeyGroups[G] & string}`;
}[keyof SettingKeyGroups];

const resolveKeyId = (id: SettingKeyId): string => {
  const [groupName, member] = id.split(".") as [keyof SettingKeyGroups, string];
  return (SETTING_KEY_GROUPS[groupName] as Record<string, string>)[member];
};

/** Keys that are not a searchable row. A key must land here or in AUTHORED_SETTINGS, or it fails to compile. */
type NonRowKeyId =
  // Reachable only from the hidden Admin panel.
  | "FEATURE_FLAG_KEYS.enableNodeSharing"
  | "FEATURE_FLAG_KEYS.suggestiveModeOverlayEnabled"
  | "FEATURE_FLAG_KEYS.useNewSettingsStore"
  | "SUGGESTIVE_MODE_KEYS.includeCurrentPageRelations"
  | "SUGGESTIVE_MODE_KEYS.includeParentAndChildBlocks"
  | "SUGGESTIVE_MODE_KEYS.pageGroups"
  // Containers whose children are the rows.
  | "GLOBAL_KEYS.export"
  | "GLOBAL_KEYS.suggestiveMode"
  | "GLOBAL_KEYS.leftSidebar"
  | "PERSONAL_KEYS.leftSidebar"
  | "PERSONAL_KEYS.query"
  | "DISCOURSE_NODE_KEYS.canvasSettings"
  | "DISCOURSE_NODE_KEYS.suggestiveRules"
  // Relations are configured by their own panel, not a settings row.
  | "GLOBAL_KEYS.relations"
  // Persisted UI state, not a setting.
  | "PERSONAL_KEYS.globalSectionFolded"
  // Per-section rows rendered from a list; no stable address yet.
  | "LEFT_SIDEBAR_KEYS.children"
  // Edited as a set by DiscourseNodeAttributes.
  | "DISCOURSE_NODE_KEYS.attributes"
  // Sub-controls of a row that is itself addressable.
  | "CANVAS_KEYS.keyImageOption"
  | "CANVAS_KEYS.queryBuilderAlias"
  | "SPECIFICATION_KEYS.enabled"
  | "SPECIFICATION_KEYS.query";

/** Compile-time proof that every exempted id is a real key. */
type AssertNonRowKeysExist = NonRowKeyId extends SettingKeyId ? true : never;
const _nonRowKeysAreReal: AssertNonRowKeysExist = true;
void _nonRowKeysAreReal;

type RowKeyId = Exclude<SettingKeyId, NonRowKeyId>;

/** What only the call site knows. `path` is the only field a relocation touches, and is a
 *  function for node-type rows so one entry expands per node type. */
export type AuthoredSetting = {
  /** Set when the value is nested, e.g. Export rows under `GLOBAL_KEYS.export`. */
  parent?: SettingKeyId;
  label: string;
  /** The enclosing `SettingsGroup` title, when the row sits in one. */
  group?: string;
  description?: string;
  docsLink?: string;
  /** Synonyms and pre-ENG-2189 section names, so muscle memory still resolves. */
  keywords?: readonly string[];
  /**
   * Omitted for settings that live outside the Settings dialog — the Export
   * options moved into the Export dialog in ENG-2185. Still authored here so a
   * row's description and docs link have one source, but not offered by a search
   * that can only navigate Settings.
   */
  path?: SettingsPath | ((nodeTypeUid: string) => SettingsPath);
  /** Settings a graph cannot reach are dropped rather than offered as dead ends. */
  isAvailable?: () => boolean;
};

/** An authored entry with its address built and its route resolved. */
export type SearchableSetting = {
  kind: "setting";
  /** Unique per result; the anchor value plus the node uid for per-node rows. */
  id: string;
  anchorId: string;
  label: string;
  description?: string;
  keywords: readonly string[];
  path: SettingsPath;
  breadcrumb: string;
};

export type SearchablePage = {
  kind: "page";
  id: string;
  label: string;
  keywords: readonly string[];
  path: SettingsPath;
  breadcrumb: string;
};

export type SearchableEntry = SearchableSetting | SearchablePage;

const nodePath =
  (...subPages: string[]) =>
  (nodeTypeUid: string): SettingsPath => [
    SETTINGS_TAB_IDS.grammarNodes,
    nodeTypeUid,
    ...subPages,
  ];

/** Labels mirror the rendered text, not the key (`GLOBAL_KEYS.trigger` renders as
 *  "Graph-wide default"), because users search for what they saw. */
const AUTHORED_SETTINGS = {
  "GLOBAL_KEYS.trigger": {
    label: "Graph-wide default",
    group: "Node trigger",
    description: "The trigger to create the node menu.",
    docsLink: ROAM_DOCS.creatingNodes,
    keywords: ["trigger", "node menu", "global"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesGeneral),
  },
  "PERSONAL_KEYS.personalNodeMenuTrigger": {
    label: "Personal override",
    group: "Node trigger",
    description: "Override the global trigger for the discourse node menu.",
    docsLink: ROAM_DOCS.creatingNodes,
    keywords: ["trigger", "node menu", "personal"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesGeneral),
  },
  "PERSONAL_KEYS.nodeSearchMenuTrigger": {
    label: "Node search menu trigger",
    description: "Set the trigger character for the node search menu.",
    keywords: ["personal"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesGeneral),
  },
  "PERSONAL_KEYS.textSelectionPopup": {
    label: "Text selection popup",
    description:
      "Whether or not to show the discourse node menu when selecting text.",
    docsLink: ROAM_DOCS.creatingNodes,
    keywords: ["personal", "highlight"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesGeneral),
  },
  "PERSONAL_KEYS.disableSidebarOpen": {
    label: "Disable sidebar open",
    description: "Disable opening new nodes in the sidebar when created",
    keywords: ["personal", "right sidebar"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesGeneral),
  },
  "PERSONAL_KEYS.reifiedRelationTriples": {
    label: "Enable stored relations",
    description:
      "Use stored relations instead of legacy pattern-based relations",
    docsLink: ROAM_DOCS.migrationToStoredRelations,
    keywords: ["personal", "reified", "triples"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesGeneral),
  },
  "PERSONAL_KEYS.disableProductDiagnostics": {
    label: "Disable product diagnostics",
    description:
      "Disable sending usage signals and error reports that help us improve the product.",
    keywords: ["personal", "telemetry", "analytics", "privacy"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesGeneral),
  },
  "PERSONAL_KEYS.streamlineStyling": {
    label: "Streamline styling",
    description:
      "Apply streamlined styling to your personal graph for a cleaner appearance.",
    keywords: ["personal", "theme", "appearance"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesStyling),
  },
  "PERSONAL_KEYS.hideFeedbackButton": {
    label: "Hide feedback button",
    description:
      "Hide the 'Send feedback' button at the bottom right of the screen.",
    keywords: ["personal", "appearance"],
    path: rootPath(SETTINGS_TAB_IDS.preferencesStyling),
  },
  "PERSONAL_KEYS.discourseContextOverlay": {
    label: "Overlay",
    description:
      "Whether or not to overlay discourse context information over discourse node references.",
    docsLink: ROAM_DOCS.discourseContextOverlay,
    keywords: ["personal", "discourse context"],
    path: rootPath(SETTINGS_TAB_IDS.featuresDiscourseContext),
  },
  "PERSONAL_KEYS.overlayInCanvas": {
    label: "(BETA) Overlay in canvas",
    description:
      "Whether or not to overlay discourse context information over canvas nodes.",
    docsLink: ROAM_DOCS.discourseContextOverlay,
    keywords: ["personal", "discourse context", "canvas"],
    path: rootPath(SETTINGS_TAB_IDS.featuresDiscourseContext),
  },
  "GLOBAL_KEYS.canvasPageFormat": {
    label: "Canvas Page Format",
    description: "The page format for canvas pages",
    keywords: ["global", "tldraw"],
    path: rootPath(SETTINGS_TAB_IDS.featuresCanvas),
  },
  "PERSONAL_KEYS.discourseToolShortcut": {
    label: "Discourse tool keyboard shortcut",
    description:
      "Set a single key to activate the discourse tool in tldraw. Only single keys (no modifiers) are supported. Leave empty for no shortcut.",
    docsLink: ROAM_DOCS.creatingNodes,
    keywords: ["personal", "tldraw", "hotkey"],
    path: rootPath(SETTINGS_TAB_IDS.featuresCanvas),
  },
  // One row for the whole per-node grid: the overrides share a single stored
  // value and a single anchor, so search lands on the grid rather than a node.
  "PERSONAL_KEYS.canvasNodeShortcuts": {
    label: "Override the canvas keyboard shortcuts",
    description:
      "Replace the per-node-type shortcut keys used on the canvas. Changes take effect next time a canvas is opened.",
    keywords: ["personal", "tldraw", "hotkey", "node type"],
    path: rootPath(SETTINGS_TAB_IDS.featuresCanvas),
  },
  "PERSONAL_KEYS.autoCanvasRelations": {
    label: "Auto canvas relations",
    description:
      "Automatically add discourse relations to canvas when a node is added",
    docsLink: ROAM_DOCS.storedRelations,
    keywords: ["personal", "tldraw"],
    path: rootPath(SETTINGS_TAB_IDS.featuresCanvas),
  },
  "FEATURE_FLAG_KEYS.enableLeftSidebar": {
    label: "Enable left sidebar",
    description: "Whether or not to enable the left sidebar.",
    keywords: ["global", "shortcuts"],
    path: rootPath(SETTINGS_TAB_IDS.featuresLeftSidebar),
  },
  "QUERY_KEYS.hideQueryMetadata": {
    parent: "PERSONAL_KEYS.query",
    label: "Hide query metadata",
    description: "Hide the Roam blocks that are used to power each query",
    docsLink: ROAM_DOCS.querying,
    keywords: ["personal", "query builder"],
    path: rootPath(SETTINGS_TAB_IDS.advancedQueries),
  },
  "QUERY_KEYS.defaultPageSize": {
    parent: "PERSONAL_KEYS.query",
    label: "Default page size",
    description: "The default page size used for query results",
    docsLink: ROAM_DOCS.querying,
    keywords: ["personal", "query builder", "pagination"],
    path: rootPath(SETTINGS_TAB_IDS.advancedQueries),
  },
  "QUERY_KEYS.queryPages": {
    parent: "PERSONAL_KEYS.query",
    label: "Query pages",
    description:
      "The title formats of pages that you would like to serve as pages that generate queries",
    docsLink: ROAM_DOCS.querying,
    keywords: ["personal", "query builder"],
    path: rootPath(SETTINGS_TAB_IDS.advancedQueries),
  },
  "QUERY_KEYS.defaultFilters": {
    parent: "PERSONAL_KEYS.query",
    label: "Default filters",
    description:
      "Any filters that should be applied to your results by default",
    docsLink: ROAM_DOCS.querying,
    keywords: ["personal", "query builder"],
    path: rootPath(SETTINGS_TAB_IDS.advancedQueries),
  },
  // No `path`: ENG-2185 moved these seven out of Settings and into the Export
  // dialog's Export options, so settings search cannot navigate to them.
  "EXPORT_KEYS.removeSpecialCharacters": {
    parent: "GLOBAL_KEYS.export",
    label: "remove special characters",
    description:
      "Whether or not to remove the special characters in a file name.",
    docsLink: ROAM_DOCS.sharing,
    keywords: ["global", "markdown", "filename"],
  },
  "EXPORT_KEYS.resolveBlockReferences": {
    parent: "GLOBAL_KEYS.export",
    label: "resolve block references",
    description:
      "Replaces block references in the markdown content with the block's content.",
    docsLink: ROAM_DOCS.sharing,
    keywords: ["global", "markdown"],
  },
  "EXPORT_KEYS.resolveBlockEmbeds": {
    parent: "GLOBAL_KEYS.export",
    label: "resolve block embeds",
    description:
      "Replaces block embeds in the markdown content with the block's content tree.",
    docsLink: ROAM_DOCS.sharing,
    keywords: ["global", "markdown"],
  },
  "EXPORT_KEYS.appendReferencedNode": {
    parent: "GLOBAL_KEYS.export",
    label: "append referenced node",
    description:
      "If a referenced node is defined in a node's format, it will be appended to the discourse context.",
    docsLink: ROAM_DOCS.sharing,
    keywords: ["global", "markdown"],
  },
  "EXPORT_KEYS.linkType": {
    parent: "GLOBAL_KEYS.export",
    label: "link type",
    description: "How to format links that appear in your export.",
    docsLink: ROAM_DOCS.sharing,
    keywords: ["global", "markdown", "wikilinks", "alias"],
  },
  "EXPORT_KEYS.maxFilenameLength": {
    parent: "GLOBAL_KEYS.export",
    label: "max filename length",
    description: "Set the maximum name length for markdown file exports.",
    docsLink: ROAM_DOCS.sharing,
    keywords: ["global", "markdown", "filename"],
  },
  "EXPORT_KEYS.frontmatter": {
    parent: "GLOBAL_KEYS.export",
    label: "frontmatter",
    description:
      "Specify all the lines that should go to the Frontmatter of the markdown file.",
    docsLink: ROAM_DOCS.sharing,
    keywords: ["global", "markdown", "yaml"],
  },
  "CANVAS_KEYS.color": {
    parent: "DISCOURSE_NODE_KEYS.canvasSettings",
    label: "Color",
    description: "Changes the color of tags and canvas nodes",
    keywords: ["node type", "canvas", "tag"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.description": {
    label: "Description",
    group: "Identity",
    description: "Describing what the node represents in your graph.",
    docsLink: ROAM_DOCS.grammarNodes,
    keywords: ["node type"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.tag": {
    label: "Tag",
    group: "Identity",
    description: "Designate a hashtag for marking potential nodes.",
    docsLink: ROAM_DOCS.taggingCandidateNodes,
    keywords: ["node type", "hashtag"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.format": {
    label: "Format",
    group: "Recognition",
    description:
      "DEPRECATED - Use specification instead. The format pages should have.",
    docsLink: ROAM_DOCS.grammarNodes,
    keywords: ["node type", "deprecated"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.specification": {
    label: "Specification",
    group: "Recognition",
    description: "The conditions specified to identify a node.",
    docsLink: ROAM_DOCS.grammarNodes,
    keywords: ["node type", "query", "conditions"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.index": {
    label: "Index",
    group: "Recognition",
    description:
      "The saved list of all pages — which pages appear and which columns show.",
    keywords: ["node type", "table", "columns"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.shortcut": {
    label: "Shortcut",
    group: "Creation",
    description: "The trigger to quickly create a page from the node menu.",
    docsLink: ROAM_DOCS.creatingNodes,
    keywords: ["node type", "hotkey", "trigger"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.template": {
    // The row itself lives on the node page; its editor is the template sub-page.
    label: "Template",
    group: "Creation",
    description: "The template that auto fills a page when generated.",
    docsLink: ROAM_DOCS.creatingNodes,
    keywords: ["node type"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.overlay": {
    label: "Overlay",
    group: "Attributes",
    description: "Select which attribute is used for the discourse overlay",
    docsLink: ROAM_DOCS.discourseAttributes,
    keywords: ["node type", "attributes"],
    path: nodePath(),
  },
  "CANVAS_KEYS.alias": {
    parent: "DISCOURSE_NODE_KEYS.canvasSettings",
    label: "Display alias",
    group: "Canvas",
    keywords: ["node type", "tldraw"],
    path: nodePath(),
  },
  "CANVAS_KEYS.keyImage": {
    parent: "DISCOURSE_NODE_KEYS.canvasSettings",
    label: "Key image",
    group: "Canvas",
    description: "Add an image to the discourse node",
    keywords: ["node type", "tldraw"],
    path: nodePath(),
  },
  "DISCOURSE_NODE_KEYS.graphOverview": {
    label: "Graph Overview",
    group: "Canvas",
    description:
      "Whether to color the node in the graph overview based on canvas color.",
    keywords: ["node type", "color"],
    path: nodePath(),
  },
  "SUGGESTIVE_RULES_KEYS.embeddingRef": {
    parent: "DISCOURSE_NODE_KEYS.suggestiveRules",
    label: "Embedding Block Ref",
    group: "Suggestive mode",
    description:
      "Copy block ref from template which you want to be embedded and ranked.",
    keywords: ["node type", "suggestive"],
    path: nodePath(),
    isAvailable: isSyncEnabled,
  },
  "SUGGESTIVE_RULES_KEYS.isFirstChild": {
    parent: "DISCOURSE_NODE_KEYS.suggestiveRules",
    label: "First Child",
    group: "Suggestive mode",
    description:
      "If the block is the first child of the embedding block ref, it will be embedded and ranked.",
    keywords: ["node type", "suggestive"],
    path: nodePath(),
    isAvailable: isSyncEnabled,
  },
} satisfies Record<RowKeyId, AuthoredSetting>;

const settingKeysOf = (
  id: RowKeyId,
  setting: AuthoredSetting,
): readonly string[] =>
  setting.parent
    ? [resolveKeyId(setting.parent), resolveKeyId(id)]
    : [resolveKeyId(id)];

const isNodeTypePath = (
  path: AuthoredSetting["path"],
): path is (nodeTypeUid: string) => SettingsPath => typeof path === "function";

const breadcrumbOf = (path: SettingsPath, trailing: string[]): string => {
  const meta = SETTINGS_TAB_META[path[0] as keyof typeof SETTINGS_TAB_META];
  const head = meta ? [meta.section, meta.label] : [String(path[0])];
  return [...head, ...trailing].filter(Boolean).join(" \u203a ");
};

const toSearchable = ({
  setting,
  anchorId,
  path,
  idSuffix,
  trailing,
}: {
  setting: AuthoredSetting;
  anchorId: string;
  path: SettingsPath;
  idSuffix?: string;
  trailing: string[];
}): SearchableSetting => ({
  kind: "setting",
  id: idSuffix ? `${anchorId}@${idSuffix}` : anchorId,
  anchorId,
  label: setting.label,
  description: setting.description,
  keywords: setting.keywords ?? [],
  path,
  breadcrumb: breadcrumbOf(path, trailing),
});

const buildPages = (): SearchablePage[] =>
  Object.entries(SETTINGS_TAB_META)
    .filter(([, meta]) => meta.searchable)
    .map(([tabId, meta]) => ({
      kind: "page" as const,
      id: `page:${tabId}`,
      label: meta.label,
      keywords: [meta.section],
      path: rootPath(tabId),
      breadcrumb: meta.section,
    }));

/** Rebuilt per query, not memoised: node types and feature gates change while Settings is
 *  open, and `getDiscourseNodes` is cache-backed. */
export const buildSettingsCatalog = (): SearchableEntry[] => {
  const available = (
    Object.entries(AUTHORED_SETTINGS) as [RowKeyId, AuthoredSetting][]
  ).filter(
    // A path-less entry is authored only for its description; it is not somewhere
    // this search can navigate to.
    ([, setting]) =>
      setting.path !== undefined && (setting.isAvailable?.() ?? true),
  );
  const nodeTypes = available.some(([, setting]) =>
    isNodeTypePath(setting.path),
  )
    ? getDiscourseNodes().filter(excludeDefaultNodes)
    : [];

  const settings = available.flatMap(([id, setting]): SearchableSetting[] => {
    const anchorId = settingKeysOf(id, setting).join("/");
    const groupTrail = setting.group ? [setting.group] : [];
    const { path } = setting;
    if (path === undefined) return [];
    if (!isNodeTypePath(path)) {
      return [toSearchable({ setting, anchorId, path, trailing: groupTrail })];
    }
    return nodeTypes.map((node) =>
      toSearchable({
        setting,
        anchorId,
        path: path(node.type),
        idSuffix: node.type,
        trailing: [node.text, ...groupTrail],
      }),
    );
  });

  return [...settings, ...buildPages()];
};

const BY_ADDRESS = new Map(
  (Object.entries(AUTHORED_SETTINGS) as [RowKeyId, AuthoredSetting][]).map(
    ([id, setting]) => [settingKeysOf(id, setting).join("/"), setting],
  ),
);

/** Lets a row omit the description prop and read it from here, so the two cannot drift
 *  apart. ENG-2187 migrates the remaining call sites. */
export const describedSetting = (
  settingKeys: readonly string[] | undefined,
): { description?: string; docsLink?: string } | undefined => {
  if (!settingKeys?.length) return undefined;
  const setting = BY_ADDRESS.get(settingKeys.join("/"));
  if (!setting?.description) return undefined;
  return { description: setting.description, docsLink: setting.docsLink };
};
