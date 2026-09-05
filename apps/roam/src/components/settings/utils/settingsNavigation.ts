import type { TabId } from "@blueprintjs/core";
import {
  SETTINGS_TAB_IDS,
  isSettingsTabId,
  resolveSettingsTabId,
} from "./settingsTabs";

/** Settings dialog route: `["grammar-nodes", nodeTypeUid, "template"]`, tab first. */
export type SettingsPath = readonly string[];

export type SettingsNavAction =
  | { type: "select-tab"; tabId: string }
  | { type: "navigate"; path: SettingsPath }
  | { type: "push"; segment: string }
  | { type: "pop" }
  | { type: "truncate"; depth: number };

export const nodeConfigSegmentIds = {
  index: "index",
  template: "template",
} as const;

export const rootPath = (tabId: string): SettingsPath => [tabId];

export const tabIdOf = (path: SettingsPath): string => path[0] ?? "";

/** Drill-down segments below the tab; 0 is the tab's own root page. */
export const depthOf = (path: SettingsPath): number =>
  Math.max(0, path.length - 1);

export const segmentsOf = (path: SettingsPath): readonly string[] =>
  path.slice(1);

export const isSamePath = (a: SettingsPath, b: SettingsPath): boolean =>
  a.length === b.length && a.every((segment, index) => segment === b[index]);

export const settingsNavReducer = (
  state: SettingsPath,
  action: SettingsNavAction,
): SettingsPath => {
  switch (action.type) {
    case "select-tab":
      return action.tabId === tabIdOf(state) && state.length === 1
        ? state
        : rootPath(action.tabId);
    // Search jumps to a setting several segments deep in one go, which `push`
    // cannot express. An empty path is ignored rather than emptying the route.
    case "navigate":
      return action.path.length === 0 || isSamePath(action.path, state)
        ? state
        : [...action.path];
    case "push":
      return [...state, action.segment];
    case "pop":
      return state.length <= 1 ? state : state.slice(0, -1);
    case "truncate": {
      const length = Math.max(1, action.depth + 1);
      return length >= state.length ? state : state.slice(0, length);
    }
  }
};

/**
 * Resolves the tab a caller asked for, including the aliases in `settingsTabs`. An id that
 * is not a tab at all is a node type uid from when every node type had its own rail tab;
 * those links now open the node's page inside Grammar > Nodes.
 */
export const resolveInitialSettingsPath = (
  selectedTabId?: TabId,
): SettingsPath => {
  const tabId = resolveSettingsTabId(selectedTabId);
  return isSettingsTabId(tabId)
    ? rootPath(tabId)
    : [SETTINGS_TAB_IDS.grammarNodes, String(tabId)];
};

export type SettingsCrumb = {
  label: string;
  depth: number;
  isCurrent: boolean;
};

export const buildBreadcrumbTrail = ({
  path,
  rootLabel,
  resolveLabel,
}: {
  path: SettingsPath;
  rootLabel: string;
  resolveLabel: (segment: string, segmentIndex: number) => string;
}): SettingsCrumb[] => {
  const segments = segmentsOf(path);
  return [
    { label: rootLabel, depth: 0, isCurrent: segments.length === 0 },
    ...segments.map((segment, index) => ({
      label: resolveLabel(segment, index),
      depth: index + 1,
      isCurrent: index === segments.length - 1,
    })),
  ];
};
