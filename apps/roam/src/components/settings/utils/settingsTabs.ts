import type { TabId } from "@blueprintjs/core";

export const SETTINGS_TAB_IDS = {
  preferencesGeneral: "preferences-general",
  preferencesStyling: "preferences-styling",
  featuresDiscourseContext: "features-discourse-context",
  featuresCanvas: "features-canvas",
  featuresLeftSidebar: "features-left-sidebar",
  grammarNodes: "grammar-nodes",
  grammarRelations: "grammar-relations",
  advancedQueries: "advanced-queries",
  admin: "secret-admin-panel",
} as const;

export const DEFAULT_SETTINGS_TAB_ID: TabId =
  SETTINGS_TAB_IDS.preferencesGeneral;

/** Tab ids from before the taxonomy. Saved deep links still carry these. */
export const SETTINGS_TAB_ALIASES: Record<string, TabId> = {
  "discourse-graph-home-personal": SETTINGS_TAB_IDS.preferencesGeneral,
  "discourse-graph-home": SETTINGS_TAB_IDS.preferencesGeneral,
  "query-settings": SETTINGS_TAB_IDS.advancedQueries,
  "canvas-shortcuts-personal-settings": SETTINGS_TAB_IDS.featuresCanvas,
  "left-sidebar-personal-settings": SETTINGS_TAB_IDS.featuresLeftSidebar,
  "left-sidebar-global-settings": SETTINGS_TAB_IDS.featuresLeftSidebar,
  // Export options left Settings in ENG-2185; they now live in the Export dialog.
  "discourse-graph-export": SETTINGS_TAB_IDS.preferencesGeneral,
  "discourse-nodes": SETTINGS_TAB_IDS.grammarNodes,
  "discourse-relations": SETTINGS_TAB_IDS.grammarRelations,
};

export type SettingsTabId =
  (typeof SETTINGS_TAB_IDS)[keyof typeof SETTINGS_TAB_IDS];

const SETTINGS_TAB_ID_SET: ReadonlySet<string> = new Set(
  Object.values(SETTINGS_TAB_IDS),
);

/** Anything that is not a tab is a node type uid from the old per-node tabs. */
export const isSettingsTabId = (id: TabId): id is SettingsTabId =>
  SETTINGS_TAB_ID_SET.has(String(id));

/** Unknown ids pass through: see `isSettingsTabId` for what they are. */
export const resolveSettingsTabId = (id?: TabId): TabId => {
  if (id === undefined) return DEFAULT_SETTINGS_TAB_ID;
  return SETTINGS_TAB_ALIASES[String(id)] ?? id;
};
