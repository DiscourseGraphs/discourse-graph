import { describe, expect, it } from "vitest";
import {
  ADMIN_TAB_ID,
  resolveVisibleTabId,
  settingsTabIds,
} from "~/utils/settingsTabIds";

const nodes = [{ type: "abc123" }, { type: "def456" }];

describe("resolveVisibleTabId", () => {
  it("keeps a node tab id that is present in the node list", () => {
    expect(resolveVisibleTabId({ requestedTabId: "abc123", nodes })).toBe(
      "abc123",
    );
  });

  it("keeps every static tab id", () => {
    const staticIds = [
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

    for (const id of staticIds) {
      expect(resolveVisibleTabId({ requestedTabId: id, nodes })).toBe(id);
    }
  });

  // Regression: a node type created moments ago is not yet in the cached node list, so
  // selecting it used to leave Blueprint with no matching Tab and render a blank dialog.
  it("falls back to Home for a node tab id missing from the node list", () => {
    expect(
      resolveVisibleTabId({ requestedTabId: "just-created-uid", nodes }),
    ).toBe(settingsTabIds.homePersonal);
  });

  it("falls back to Home when there are no node types at all", () => {
    expect(resolveVisibleTabId({ requestedTabId: "abc123", nodes: [] })).toBe(
      settingsTabIds.homePersonal,
    );
  });
});
