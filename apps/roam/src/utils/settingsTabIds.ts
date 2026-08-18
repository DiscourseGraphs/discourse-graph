import type { TabId } from "@blueprintjs/core";
import type { DiscourseNode } from "./getDiscourseNodes";

export const settingsTabIds = {
  homePersonal: "discourse-graph-home-personal",
  leftSidebarPersonal: "left-sidebar-personal-settings",
  leftSidebarGlobal: "left-sidebar-global-settings",
} as const;

export const ADMIN_TAB_ID = "secret-admin-panel";

// Every non-node Tab id rendered by Settings must be listed here.
export const STATIC_TAB_IDS: readonly string[] = [
  settingsTabIds.homePersonal,
  settingsTabIds.leftSidebarPersonal,
  settingsTabIds.leftSidebarGlobal,
  ADMIN_TAB_ID,
  "query-settings",
  "canvas-shortcuts-personal-settings",
  "discourse-graph-home",
  "discourse-graph-export",
  "discourse-relations",
  "discourse-nodes",
];

/**
 * Blueprint renders no panel at all when selectedTabId matches no Tab, which reads to the
 * user as a blank dialog rather than an error. Node tabs come from a cache that can lag
 * behind a freshly created node type, so an unknown id falls back to Home (ENG-2089).
 */
export const resolveVisibleTabId = ({
  requestedTabId,
  nodes,
}: {
  requestedTabId: TabId;
  nodes: Pick<DiscourseNode, "type">[];
}): TabId => {
  if (STATIC_TAB_IDS.includes(String(requestedTabId))) return requestedTabId;
  if (nodes.some((node) => node.type === requestedTabId)) return requestedTabId;
  return settingsTabIds.homePersonal;
};
