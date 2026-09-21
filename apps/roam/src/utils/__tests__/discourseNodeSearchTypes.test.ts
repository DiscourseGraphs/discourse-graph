import { describe, expect, it } from "vitest";
import {
  combineSemanticAndMiniSearchResults,
  compareByRelevance,
  type DiscourseNodeSearchSource,
  type ScoredSearchResult,
} from "~/utils/discourseNodeSearchTypes";

const makeEntry = ({
  uid,
  score,
  rank,
  source,
}: {
  uid: string;
  score: number;
  rank: number;
  source: DiscourseNodeSearchSource;
}): ScoredSearchResult => ({
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
  score,
  rank,
  source,
});

const sortByRelevance = (
  entries: ScoredSearchResult[],
  descending = true,
): string[] =>
  [...entries]
    .sort((a, b) => compareByRelevance({ a, b, descending }))
    .map((entry) => entry.result.uid);

describe("combineSemanticAndMiniSearchResults", () => {
  it("drops duplicate uids from both sources", () => {
    const combined = combineSemanticAndMiniSearchResults({
      semantic: [
        makeEntry({ uid: "a", score: 0.9, rank: 0, source: "semantic" }),
        makeEntry({ uid: "a", score: 0.7, rank: 1, source: "semantic" }),
        makeEntry({ uid: "b", score: 0.5, rank: 2, source: "semantic" }),
      ],
      miniSearch: [
        makeEntry({ uid: "b", score: 10, rank: 0, source: "miniSearch" }),
        makeEntry({ uid: "c", score: 8, rank: 1, source: "miniSearch" }),
      ],
    });

    expect(combined.map((entry) => entry.result.uid)).toEqual(["a", "b", "c"]);
    expect(combined[0]?.score).toBe(0.9);
  });
});

describe("compareByRelevance", () => {
  it("keeps Roam's returned order for semantic results regardless of score", () => {
    const entries = [
      makeEntry({ uid: "second", score: 0.91, rank: 1, source: "semantic" }),
      makeEntry({ uid: "first", score: 0.12, rank: 0, source: "semantic" }),
      makeEntry({ uid: "third", score: 0.55, rank: 2, source: "semantic" }),
    ];

    expect(sortByRelevance(entries)).toEqual(["first", "second", "third"]);
  });

  it("sorts MiniSearch results by score", () => {
    const entries = [
      makeEntry({ uid: "low", score: 2, rank: 1, source: "miniSearch" }),
      makeEntry({ uid: "high", score: 9, rank: 0, source: "miniSearch" }),
    ];

    expect(sortByRelevance(entries)).toEqual(["high", "low"]);
  });

  it("puts semantic results ahead of MiniSearch results in both directions", () => {
    const entries = [
      makeEntry({ uid: "mini", score: 99, rank: 0, source: "miniSearch" }),
      makeEntry({ uid: "semantic", score: 0.01, rank: 0, source: "semantic" }),
    ];

    expect(sortByRelevance(entries)).toEqual(["semantic", "mini"]);
    expect(sortByRelevance(entries, false)).toEqual(["semantic", "mini"]);
  });

  it("reverses within-source order when sorting ascending", () => {
    const entries = [
      makeEntry({ uid: "first", score: 0.1, rank: 0, source: "semantic" }),
      makeEntry({ uid: "second", score: 0.9, rank: 1, source: "semantic" }),
    ];

    expect(sortByRelevance(entries, false)).toEqual(["second", "first"]);
  });
});
