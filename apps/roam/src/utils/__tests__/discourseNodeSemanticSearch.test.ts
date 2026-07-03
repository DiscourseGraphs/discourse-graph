import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";

const mockRunRoamSemanticSearch = vi.fn();

vi.mock("~/utils/discourseNodeSearchProviders", () => ({
  runRoamSemanticSearch: (...args: unknown[]) =>
    mockRunRoamSemanticSearch(...args),
}));

import {
  SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS,
  combineDiscourseSearchResults,
  searchDiscourseNodesWithSemanticFallback,
  shouldUseRoamSemanticSearch,
  type DiscourseSearchHit,
} from "~/utils/discourseNodeSemanticSearch";

const nodeTypes = [
  { type: "claim", format: "[[C]] - {content}" },
] as DiscourseNode[];

const semanticHit = (
  uid: string,
  score: number,
  text = `[[C]] - ${uid}`,
): DiscourseSearchHit => ({
  uid,
  text,
  type: "claim",
  nodeTypeLabel: "Claim",
  score,
  source: "semantic",
});

const keywordHit = (
  uid: string,
  score: number,
  text = `[[C]] - ${uid}`,
): DiscourseSearchHit => ({
  uid,
  text,
  type: "claim",
  nodeTypeLabel: "Claim",
  score,
  source: "keyword",
});

const providerPayload = (
  filteredResults: Array<{
    uid: string;
    text: string;
    type?: string;
    nodeTypeLabel?: string;
    score?: number;
  }>,
) => ({
  rawResults: filteredResults,
  rawResultCount: filteredResults.length,
  filteredResults,
  filteredResultCount: filteredResults.length,
});

describe("shouldUseRoamSemanticSearch", () => {
  beforeEach(() => {
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        data: {
          semanticSearchEnabled: vi.fn(() => false),
        },
      },
    };
  });

  it("returns the Roam semantic search enabled flag", () => {
    const semanticSearchEnabled = vi.fn(() => true);
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        data: { semanticSearchEnabled },
      },
    };

    expect(shouldUseRoamSemanticSearch()).toBe(true);
    expect(semanticSearchEnabled).toHaveBeenCalled();
  });
});

describe("combineDiscourseSearchResults", () => {
  it("keeps semantic order and appends deduped keyword hits", () => {
    const combined = combineDiscourseSearchResults({
      semantic: [semanticHit("a", 0.9), semanticHit("b", 0.8)],
      keyword: [keywordHit("b", 0.7), keywordHit("c", 0.6)],
    });

    expect(combined.map((hit) => hit.uid)).toEqual(["a", "b", "c"]);
    expect(combined[0]?.source).toBe("semantic");
    expect(combined[2]?.source).toBe("keyword");
  });
});

describe("searchDiscourseNodesWithSemanticFallback", () => {
  const runKeywordSearch = vi.fn(() => [
    keywordHit("keyword-1", 0.5),
    keywordHit("keyword-2", 0.4),
  ]);

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as { window: unknown }).window = {
      roamAlphaAPI: {
        data: {
          semanticSearchEnabled: vi.fn(() => true),
        },
      },
    };
  });

  it("uses keyword search only when semantic search is disabled", async () => {
    (
      window.roamAlphaAPI.data.semanticSearchEnabled as ReturnType<typeof vi.fn>
    ).mockReturnValue(false);

    const results = await searchDiscourseNodesWithSemanticFallback({
      nodeTypes,
      query: "meaning",
      runKeywordSearch,
    });

    expect(results).toEqual(runKeywordSearch.mock.results[0]?.value);
    expect(mockRunRoamSemanticSearch).not.toHaveBeenCalled();
  });

  it("returns semantic results only when post-filter count is at threshold", async () => {
    const filteredResults = Array.from(
      { length: SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS },
      (_, index) => ({
        uid: `semantic-${index}`,
        text: `[[C]] - semantic-${index}`,
        type: "claim",
        nodeTypeLabel: "Claim",
        score: 1 - index * 0.1,
      }),
    );
    mockRunRoamSemanticSearch.mockResolvedValue(
      providerPayload(filteredResults),
    );

    const results = await searchDiscourseNodesWithSemanticFallback({
      nodeTypes,
      query: "meaning",
      runKeywordSearch,
    });

    expect(results).toHaveLength(SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS);
    expect(results.every((hit) => hit.source === "semantic")).toBe(true);
    expect(runKeywordSearch).not.toHaveBeenCalled();
  });

  it("combines semantic and keyword results when post-filter count is below threshold", async () => {
    mockRunRoamSemanticSearch.mockResolvedValue(
      providerPayload([
        {
          uid: "semantic-1",
          text: "[[C]] - semantic-1",
          type: "claim",
          nodeTypeLabel: "Claim",
          score: 0.9,
        },
        {
          uid: "keyword-1",
          text: "[[C]] - keyword-1",
          type: "claim",
          nodeTypeLabel: "Claim",
          score: 0.8,
        },
      ]),
    );

    const results = await searchDiscourseNodesWithSemanticFallback({
      nodeTypes,
      query: "meaning",
      runKeywordSearch,
    });

    expect(results.map((hit) => hit.uid)).toEqual([
      "semantic-1",
      "keyword-1",
      "keyword-2",
    ]);
    expect(runKeywordSearch).toHaveBeenCalledTimes(1);
  });

  it("falls back to keyword search when the Roam semantic API throws", async () => {
    mockRunRoamSemanticSearch.mockRejectedValue(new Error("semantic failed"));

    const results = await searchDiscourseNodesWithSemanticFallback({
      nodeTypes,
      query: "meaning",
      runKeywordSearch,
    });

    expect(results).toEqual(runKeywordSearch.mock.results[0]?.value);
    expect(results.every((hit) => hit.source === "keyword")).toBe(true);
  });

  it("returns an empty list for blank queries", async () => {
    const results = await searchDiscourseNodesWithSemanticFallback({
      nodeTypes,
      query: "   ",
      runKeywordSearch,
    });

    expect(results).toEqual([]);
    expect(mockRunRoamSemanticSearch).not.toHaveBeenCalled();
    expect(runKeywordSearch).not.toHaveBeenCalled();
  });
});
