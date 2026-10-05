import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type SemanticProviderPayload = {
  filteredResults: { uid: string; text: string }[];
  filteredResultCount: number;
};

const runRoamSemanticSearch =
  vi.fn<(args: unknown) => Promise<SemanticProviderPayload>>();
vi.mock("~/utils/discourseNodeSearchProviders", () => ({
  runRoamSemanticSearch: (args: unknown) => runRoamSemanticSearch(args),
}));

import { searchDiscourseNodes } from "~/utils/searchDiscourseNodes";
import {
  MAX_RESULTS,
  type ScoredSearchResult,
  type SearchResult,
} from "~/utils/discourseNodeSearchTypes";

const originalWindow = (globalThis as { window?: unknown }).window;

const setSemanticSearchEnabled = (enabled: boolean): void => {
  (globalThis as { window: unknown }).window = {
    roamAlphaAPI: { data: { semanticSearchEnabled: () => enabled } },
  };
};

// Roam returns hits without a score, so semantic entries carry score 0.
const semanticHits = (count: number): { uid: string; text: string }[] =>
  Array.from({ length: count }, (_, i) => ({
    uid: `s${i}`,
    text: `[[CLM]] - semantic ${i}`,
  }));

const miniSearchEntry = (uid: string): ScoredSearchResult => ({
  result: {
    uid,
    title: `[[CLM]] - ${uid}`,
    type: "clm",
    nodeTypeLabel: "Claim",
    excerpt: "",
    createdAt: "",
    lastModified: "",
    authorName: "",
  },
  score: 9,
  source: "miniSearch",
});

const search = (
  runMiniSearch: () => ScoredSearchResult[],
): Promise<ScoredSearchResult[]> =>
  searchDiscourseNodes({
    nodeTypes: [],
    query: "governance",
    resultsByUid: new Map<string, SearchResult>(),
    runMiniSearch,
  });

beforeEach(() => {
  runRoamSemanticSearch.mockReset();
  setSemanticSearchEnabled(true);
});

afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
});

describe("searchDiscourseNodes", () => {
  it("caps the semantic path at MAX_RESULTS", async () => {
    const filteredResults = semanticHits(200);
    runRoamSemanticSearch.mockResolvedValue({
      filteredResults,
      filteredResultCount: filteredResults.length,
    });

    const results = await search(() => []);

    expect(results).toHaveLength(MAX_RESULTS);
    expect(results[0]?.result.uid).toBe("s0");
  });

  it("skips MiniSearch once semantic returns enough discourse nodes", async () => {
    const filteredResults = semanticHits(5);
    runRoamSemanticSearch.mockResolvedValue({
      filteredResults,
      filteredResultCount: filteredResults.length,
    });
    const runMiniSearch = vi.fn(() => [miniSearchEntry("m1")]);

    const results = await search(runMiniSearch);

    expect(runMiniSearch).not.toHaveBeenCalled();
    expect(results.map((r) => r.result.uid)).toEqual([
      "s0",
      "s1",
      "s2",
      "s3",
      "s4",
    ]);
  });

  it("appends MiniSearch results after sparse semantic results", async () => {
    const filteredResults = semanticHits(2);
    runRoamSemanticSearch.mockResolvedValue({
      filteredResults,
      filteredResultCount: filteredResults.length,
    });

    const results = await search(() => [
      miniSearchEntry("m1"),
      miniSearchEntry("m2"),
    ]);

    expect(results.map((r) => r.result.uid)).toEqual(["s0", "s1", "m1", "m2"]);
  });

  it("falls back to MiniSearch when the semantic provider throws", async () => {
    runRoamSemanticSearch.mockRejectedValue(new Error("semantic unavailable"));

    const results = await search(() => [miniSearchEntry("m1")]);

    expect(results.map((r) => r.result.uid)).toEqual(["m1"]);
  });

  it("degrades to an empty list when MiniSearch itself throws", async () => {
    setSemanticSearchEnabled(false);

    await expect(
      search(() => {
        throw new Error("minisearch exploded");
      }),
    ).resolves.toEqual([]);
  });

  it("returns nothing for a blank query without calling either provider", async () => {
    const runMiniSearch = vi.fn(() => [miniSearchEntry("m1")]);

    const results = await searchDiscourseNodes({
      nodeTypes: [],
      query: "   ",
      resultsByUid: new Map<string, SearchResult>(),
      runMiniSearch,
    });

    expect(results).toEqual([]);
    expect(runMiniSearch).not.toHaveBeenCalled();
    expect(runRoamSemanticSearch).not.toHaveBeenCalled();
  });
});
