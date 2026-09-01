import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildSettingsCatalog,
  describedSetting,
  type SearchableEntry,
  type SearchableSetting,
} from "../settingsCatalog";
import { SETTINGS_TAB_IDS, SETTINGS_TAB_META } from "../settingsTabs";
import {
  DISCOURSE_NODE_KEYS,
  EXPORT_KEYS,
  GLOBAL_KEYS,
  PERSONAL_KEYS,
  QUERY_KEYS,
} from "../settingKeys";

const { nodes, isSyncEnabled } = vi.hoisted(() => ({
  nodes: [
    { type: "claim-uid", text: "Claim", backedBy: "user" },
    { type: "evidence-uid", text: "Evidence", backedBy: "user" },
  ],
  isSyncEnabled: vi.fn(() => false),
}));

vi.mock("~/utils/getDiscourseNodes", () => ({
  default: () => nodes,
  excludeDefaultNodes: (node: { backedBy: string }) => node.backedBy === "user",
}));

vi.mock("../accessors", () => ({ isSyncEnabled }));

const settingsIn = (catalog: SearchableEntry[]): SearchableSetting[] =>
  catalog.filter(
    (entry): entry is SearchableSetting => entry.kind === "setting",
  );

describe("buildSettingsCatalog", () => {
  beforeEach(() => {
    isSyncEnabled.mockReturnValue(false);
  });

  it("gives every entry a route the nav reducer can take", () => {
    for (const entry of buildSettingsCatalog()) {
      expect(entry.path.length).toBeGreaterThan(0);
      expect(Object.values(SETTINGS_TAB_IDS)).toContain(entry.path[0]);
    }
  });

  it("keeps result ids unique so they are safe as React keys", () => {
    const ids = buildSettingsCatalog().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // The anchor is what the scroll-to selector matches, so a nested setting has to
  // carry its parent segment or it would collide with a same-named top-level key.
  it("addresses a nested setting by parent and key, a flat one by key alone", () => {
    const catalog = settingsIn(buildSettingsCatalog());
    const anchorFor = (label: string): string | undefined =>
      catalog.find((entry) => entry.label === label)?.anchorId;

    expect(anchorFor("Default filters")).toBe(
      `${PERSONAL_KEYS.query}/${QUERY_KEYS.defaultFilters}`,
    );
    expect(anchorFor("Text selection popup")).toBe(
      PERSONAL_KEYS.textSelectionPopup,
    );
  });

  // ENG-2185 moved these into the Export dialog, which this search cannot reach.
  it("leaves out settings that no longer live in the Settings dialog", () => {
    const exportEntries = settingsIn(buildSettingsCatalog()).filter((entry) =>
      entry.anchorId.startsWith(`${GLOBAL_KEYS.export}/`),
    );
    expect(exportEntries).toEqual([]);
  });

  // Dropping them from the index must not drop their authored copy: the rows in
  // the Export dialog still read their description from here.
  it("still resolves descriptions for settings it does not index", () => {
    const described = describedSetting([
      GLOBAL_KEYS.export,
      EXPORT_KEYS.frontmatter,
    ]);
    expect(described?.description).toContain("Frontmatter");
    expect(described?.docsLink).toBeTruthy();
  });

  it("expands a per-node-type setting once per node type", () => {
    const descriptions = settingsIn(buildSettingsCatalog()).filter(
      (entry) => entry.anchorId === DISCOURSE_NODE_KEYS.description,
    );
    expect(descriptions).toHaveLength(nodes.length);
    expect(descriptions.map((entry) => entry.path)).toEqual([
      [SETTINGS_TAB_IDS.grammarNodes, "claim-uid"],
      [SETTINGS_TAB_IDS.grammarNodes, "evidence-uid"],
    ]);
    // Same anchor, different rows: the id is what disambiguates them.
    expect(new Set(descriptions.map((entry) => entry.id)).size).toBe(2);
  });

  it("names the node type in a per-node breadcrumb", () => {
    const claimTag = settingsIn(buildSettingsCatalog()).find(
      (entry) =>
        entry.anchorId === DISCOURSE_NODE_KEYS.tag &&
        entry.path[1] === "claim-uid",
    );
    expect(claimTag?.breadcrumb).toBe("Grammar › Nodes › Claim › Identity");
  });

  it("drops settings the graph cannot reach", () => {
    const suggestive = (): SearchableSetting[] =>
      settingsIn(buildSettingsCatalog()).filter((entry) =>
        entry.anchorId.includes(DISCOURSE_NODE_KEYS.suggestiveRules),
      );
    expect(suggestive()).toEqual([]);

    isSyncEnabled.mockReturnValue(true);
    expect(suggestive().length).toBeGreaterThan(0);
  });

  it("offers a page entry for every searchable tab and no others", () => {
    const pages = buildSettingsCatalog().filter(
      (entry) => entry.kind === "page",
    );
    const expected = Object.entries(SETTINGS_TAB_META)
      .filter(([, meta]) => meta.searchable)
      .map(([tabId]) => tabId);
    expect(pages.map((page) => page.path[0]).sort()).toEqual(expected.sort());
  });

  it("keeps the hidden Admin tab out of the index", () => {
    const pages = buildSettingsCatalog().filter(
      (entry) => entry.kind === "page",
    );
    expect(pages.map((page) => page.path[0])).not.toContain(
      SETTINGS_TAB_IDS.admin,
    );
  });
});

describe("describedSetting", () => {
  it("returns nothing for an unknown or empty address", () => {
    expect(describedSetting(undefined)).toBeUndefined();
    expect(describedSetting([])).toBeUndefined();
    expect(describedSetting(["not-a-setting"])).toBeUndefined();
  });
});
