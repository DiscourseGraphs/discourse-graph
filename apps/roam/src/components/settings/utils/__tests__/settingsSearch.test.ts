import { describe, expect, it } from "vitest";
import { rankSettings, SETTINGS_SEARCH_RESULT_LIMIT } from "../settingsSearch";
import type { SearchableEntry } from "../settingsCatalog";

const setting = (
  label: string,
  extra: Partial<SearchableEntry> = {},
): SearchableEntry => ({
  kind: "setting",
  id: label,
  anchorId: label,
  label,
  keywords: [],
  path: ["preferences-general"],
  breadcrumb: "Preferences › General",
  ...extra,
});

const page = (label: string): SearchableEntry => ({
  kind: "page",
  id: `page:${label}`,
  label,
  keywords: [],
  path: ["features-canvas"],
  breadcrumb: "Features",
});

const labels = (entries: SearchableEntry[]): string[] =>
  entries.map((entry) => entry.label);

describe("rankSettings", () => {
  it("returns nothing for an empty or whitespace query", () => {
    const entries = [setting("Canvas page format")];
    expect(rankSettings({ entries, query: "" })).toEqual([]);
    expect(rankSettings({ entries, query: "   " })).toEqual([]);
  });

  it("matches case- and whitespace-insensitively", () => {
    const entries = [setting("Canvas page format")];
    expect(
      labels(rankSettings({ entries, query: "  CANVAS   page " })),
    ).toEqual(["Canvas page format"]);
  });

  // The tier order is the whole point: an exact label must never be buried under
  // a description that happens to mention the same word.
  it("orders exact label, then prefix, then substring, then description", () => {
    const entries = [
      setting("Mentions overlay in its description", {
        description: "Controls the overlay",
      }),
      setting("Overlay in canvas"),
      setting("Discourse context overlay"),
      setting("Overlay"),
    ];
    expect(labels(rankSettings({ entries, query: "overlay" }))).toEqual([
      "Overlay",
      "Overlay in canvas",
      "Discourse context overlay",
      "Mentions overlay in its description",
    ]);
  });

  it("matches a keyword and ranks it below any label match", () => {
    const entries = [
      setting("Auto canvas relations", { keywords: ["tldraw"] }),
      setting("Tldraw shortcut"),
    ];
    expect(labels(rankSettings({ entries, query: "tldraw" }))).toEqual([
      "Tldraw shortcut",
      "Auto canvas relations",
    ]);
  });

  it("puts settings before pages at the same tier, then sorts by label", () => {
    const entries = [page("Canvas"), setting("Canvas")];
    expect(
      rankSettings({ entries, query: "canvas" }).map((entry) => entry.kind),
    ).toEqual(["setting", "page"]);
  });

  it("breaks a tier tie alphabetically for a stable list", () => {
    const entries = [
      setting("Overlay zeta"),
      setting("Overlay alpha"),
      setting("Overlay mid"),
    ];
    expect(labels(rankSettings({ entries, query: "overlay " }))).toEqual([
      "Overlay alpha",
      "Overlay mid",
      "Overlay zeta",
    ]);
  });

  // Every word has to appear somewhere, but the tier still comes from the whole
  // query, so a single-word search keeps its precision.
  it("matches a multi-word query across label, breadcrumb and keywords", () => {
    const entries = [
      setting("Key image", {
        breadcrumb: "Grammar › Nodes › Claim › Canvas",
        keywords: ["tldraw"],
      }),
    ];
    expect(labels(rankSettings({ entries, query: "claim key image" }))).toEqual(
      ["Key image"],
    );
    expect(rankSettings({ entries, query: "claim key missing" })).toEqual([]);
  });

  it("does not scatter a single word across fields", () => {
    const entries = [setting("Tag", { breadcrumb: "Grammar › Nodes" })];
    expect(rankSettings({ entries, query: "zzz" })).toEqual([]);
  });

  it("caps results at the limit", () => {
    const entries = Array.from({ length: 20 }, (_, index) =>
      setting(`Overlay ${index}`),
    );
    expect(rankSettings({ entries, query: "overlay" })).toHaveLength(
      SETTINGS_SEARCH_RESULT_LIMIT,
    );
    expect(rankSettings({ entries, query: "overlay", limit: 3 })).toHaveLength(
      3,
    );
  });

  it("searches a page's breadcrumb, which is its only extra text", () => {
    const entries = [page("Canvas")];
    expect(labels(rankSettings({ entries, query: "features" }))).toEqual([
      "Canvas",
    ]);
  });
});
