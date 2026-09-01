import { describe, expect, it } from "vitest";
import {
  buildBreadcrumbTrail,
  depthOf,
  nodeConfigSegmentIds,
  resolveInitialSettingsPath,
  rootPath,
  segmentsOf,
  settingsNavReducer,
  tabIdOf,
  type SettingsPath,
} from "../settingsNavigation";
import { SETTINGS_TAB_ALIASES, SETTINGS_TAB_IDS } from "../settingsTabs";

const NODE_UID = "abc123XYZ";

describe("settingsNavReducer", () => {
  it("replaces the whole path when a different tab is selected", () => {
    const deep: SettingsPath = [
      SETTINGS_TAB_IDS.grammarNodes,
      NODE_UID,
      nodeConfigSegmentIds.template,
    ];
    expect(
      settingsNavReducer(deep, {
        type: "select-tab",
        tabId: SETTINGS_TAB_IDS.advancedQueries,
      }),
    ).toEqual([SETTINGS_TAB_IDS.advancedQueries]);
  });

  // Identity matters: the dialog re-dispatches select-tab on every Tabs onChange,
  // and a fresh array would reset the drill-down the user is already looking at.
  it("keeps the same path when re-selecting the tab at its root", () => {
    const state = rootPath(SETTINGS_TAB_IDS.featuresCanvas);
    expect(
      settingsNavReducer(state, {
        type: "select-tab",
        tabId: SETTINGS_TAB_IDS.featuresCanvas,
      }),
    ).toBe(state);
  });

  it("returns to the tab root when re-selecting the tab from a drill-down", () => {
    const deep: SettingsPath = [SETTINGS_TAB_IDS.grammarNodes, NODE_UID];
    expect(
      settingsNavReducer(deep, {
        type: "select-tab",
        tabId: SETTINGS_TAB_IDS.grammarNodes,
      }),
    ).toEqual([SETTINGS_TAB_IDS.grammarNodes]);
  });

  it("pushes and pops one segment at a time", () => {
    const root = rootPath(SETTINGS_TAB_IDS.grammarNodes);
    const atNode = settingsNavReducer(root, {
      type: "push",
      segment: NODE_UID,
    });
    const atTemplate = settingsNavReducer(atNode, {
      type: "push",
      segment: nodeConfigSegmentIds.template,
    });

    expect(atTemplate).toEqual([
      SETTINGS_TAB_IDS.grammarNodes,
      NODE_UID,
      nodeConfigSegmentIds.template,
    ]);
    expect(settingsNavReducer(atTemplate, { type: "pop" })).toEqual(atNode);
  });

  it("never pops away the tab itself", () => {
    const root = rootPath(SETTINGS_TAB_IDS.grammarNodes);
    expect(settingsNavReducer(root, { type: "pop" })).toBe(root);
  });

  it("truncates to the requested depth, counting the tab as depth 0", () => {
    const deep: SettingsPath = [
      SETTINGS_TAB_IDS.grammarNodes,
      NODE_UID,
      nodeConfigSegmentIds.index,
    ];
    expect(settingsNavReducer(deep, { type: "truncate", depth: 0 })).toEqual([
      SETTINGS_TAB_IDS.grammarNodes,
    ]);
    expect(settingsNavReducer(deep, { type: "truncate", depth: 1 })).toEqual([
      SETTINGS_TAB_IDS.grammarNodes,
      NODE_UID,
    ]);
  });

  it("leaves the path alone when truncating to at or below the current depth", () => {
    const deep: SettingsPath = [SETTINGS_TAB_IDS.grammarNodes, NODE_UID];
    expect(settingsNavReducer(deep, { type: "truncate", depth: 5 })).toBe(deep);
  });

  it("clamps a negative truncate depth to the tab root", () => {
    const deep: SettingsPath = [SETTINGS_TAB_IDS.grammarNodes, NODE_UID];
    expect(settingsNavReducer(deep, { type: "truncate", depth: -3 })).toEqual([
      SETTINGS_TAB_IDS.grammarNodes,
    ]);
  });
});

describe("resolveInitialSettingsPath", () => {
  it("defaults to Preferences > General with no tab requested", () => {
    expect(resolveInitialSettingsPath()).toEqual([
      SETTINGS_TAB_IDS.preferencesGeneral,
    ]);
  });

  it("passes a known tab id straight through", () => {
    expect(
      resolveInitialSettingsPath(SETTINGS_TAB_IDS.featuresLeftSidebar),
    ).toEqual([SETTINGS_TAB_IDS.featuresLeftSidebar]);
  });

  // A wrong alias fails silently by dropping the user on the wrong tab, so every
  // entry is pinned rather than spot-checked.
  it.each(Object.entries(SETTINGS_TAB_ALIASES))(
    "resolves the pre-taxonomy id %s to its new tab",
    (legacyId, expected) => {
      expect(resolveInitialSettingsPath(legacyId)).toEqual([expected]);
    },
  );

  it("every alias target is a real tab", () => {
    const known = new Set<string>(Object.values(SETTINGS_TAB_IDS));
    for (const target of Object.values(SETTINGS_TAB_ALIASES)) {
      expect(known).toContain(String(target));
    }
  });

  // Per-node tabs are gone; an id that is not a tab is a node type uid, and those
  // saved links now open the node inside Grammar > Nodes.
  it("treats an unknown id as a node type uid", () => {
    expect(resolveInitialSettingsPath(NODE_UID)).toEqual([
      SETTINGS_TAB_IDS.grammarNodes,
      NODE_UID,
    ]);
  });
});

describe("path helpers", () => {
  it("reads the tab, depth and segments of a path", () => {
    const deep: SettingsPath = [
      SETTINGS_TAB_IDS.grammarNodes,
      NODE_UID,
      nodeConfigSegmentIds.index,
    ];
    expect(tabIdOf(deep)).toBe(SETTINGS_TAB_IDS.grammarNodes);
    expect(depthOf(deep)).toBe(2);
    expect(segmentsOf(deep)).toEqual([NODE_UID, nodeConfigSegmentIds.index]);
  });

  it("reports depth 0 for an empty path rather than -1", () => {
    expect(depthOf([])).toBe(0);
    expect(tabIdOf([])).toBe("");
  });
});

describe("buildBreadcrumbTrail", () => {
  const resolveLabel = (segment: string, index: number): string =>
    index === 0 ? "Claim" : `sub:${segment}`;

  it("marks only the tab root as current at depth 0", () => {
    expect(
      buildBreadcrumbTrail({
        path: rootPath(SETTINGS_TAB_IDS.grammarNodes),
        rootLabel: "Nodes",
        resolveLabel,
      }),
    ).toEqual([{ label: "Nodes", depth: 0, isCurrent: true }]);
  });

  it("labels each segment and marks the last one current", () => {
    expect(
      buildBreadcrumbTrail({
        path: [
          SETTINGS_TAB_IDS.grammarNodes,
          NODE_UID,
          nodeConfigSegmentIds.template,
        ],
        rootLabel: "Nodes",
        resolveLabel,
      }),
    ).toEqual([
      { label: "Nodes", depth: 0, isCurrent: false },
      { label: "Claim", depth: 1, isCurrent: false },
      { label: "sub:template", depth: 2, isCurrent: true },
    ]);
  });

  // SettingsPageHeader reads trail[length - 2] for the Back button, so a
  // one-segment trail must still have a parent crumb to point at.
  it("always yields a parent crumb once there is a segment", () => {
    const trail = buildBreadcrumbTrail({
      path: [SETTINGS_TAB_IDS.grammarNodes, NODE_UID],
      rootLabel: "Nodes",
      resolveLabel,
    });
    expect(trail.length).toBeGreaterThanOrEqual(2);
    expect(trail[trail.length - 2].label).toBe("Nodes");
  });
});
