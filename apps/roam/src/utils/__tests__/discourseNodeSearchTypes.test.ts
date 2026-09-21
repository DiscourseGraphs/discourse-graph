import { describe, expect, it } from "vitest";
import { sortSearchResults } from "~/components/AdvancedNodeSearchDialog/utils";
import {
  combineSemanticAndMiniSearchResults,
  type DiscourseNodeSearchSource,
  type ScoredSearchResult,
} from "~/utils/discourseNodeSearchTypes";

const makeEntry = ({
  uid,
  score,
  source,
}: {
  uid: string;
  score: number;
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
  source,
});

const relevanceOrder = (
  scoredResults: ScoredSearchResult[],
  direction: "asc" | "desc" = "desc",
): string[] =>
  sortSearchResults({
    scoredResults,
    sort: { field: "relevance", direction },
  }).map((result) => result.uid);

describe("combineSemanticAndMiniSearchResults", () => {
  it("drops duplicate uids from both sources", () => {
    const combined = combineSemanticAndMiniSearchResults({
      semantic: [
        makeEntry({ uid: "a", score: 0.9, source: "semantic" }),
        makeEntry({ uid: "a", score: 0.7, source: "semantic" }),
        makeEntry({ uid: "b", score: 0.5, source: "semantic" }),
      ],
      miniSearch: [
        makeEntry({ uid: "b", score: 10, source: "miniSearch" }),
        makeEntry({ uid: "c", score: 8, source: "miniSearch" }),
      ],
    });

    expect(combined.map((entry) => entry.result.uid)).toEqual(["a", "b", "c"]);
    expect(combined[0]?.score).toBe(0.9);
  });
});

describe("sortSearchResults relevance", () => {
  it("preserves the order the providers returned, ignoring score", () => {
    const scoredResults = [
      makeEntry({ uid: "roamFirst", score: 0.12, source: "semantic" }),
      makeEntry({ uid: "roamSecond", score: 0.91, source: "semantic" }),
      makeEntry({ uid: "miniFirst", score: 9, source: "miniSearch" }),
      makeEntry({ uid: "miniSecond", score: 2, source: "miniSearch" }),
    ];

    expect(relevanceOrder(scoredResults)).toEqual([
      "roamFirst",
      "roamSecond",
      "miniFirst",
      "miniSecond",
    ]);
  });

  it("does not reorder tied scores by uid", () => {
    const scoredResults = [
      makeEntry({ uid: "zzz", score: 0, source: "semantic" }),
      makeEntry({ uid: "aaa", score: 0, source: "semantic" }),
    ];

    expect(relevanceOrder(scoredResults)).toEqual(["zzz", "aaa"]);
  });

  it("reverses the provider order when sorting ascending", () => {
    const scoredResults = [
      makeEntry({ uid: "roamFirst", score: 0.12, source: "semantic" }),
      makeEntry({ uid: "miniFirst", score: 9, source: "miniSearch" }),
    ];

    expect(relevanceOrder(scoredResults, "asc")).toEqual([
      "miniFirst",
      "roamFirst",
    ]);
  });

  it("does not mutate the input array", () => {
    const scoredResults = [
      makeEntry({ uid: "a", score: 1, source: "semantic" }),
      makeEntry({ uid: "b", score: 2, source: "miniSearch" }),
    ];

    relevanceOrder(scoredResults, "asc");

    expect(scoredResults.map((entry) => entry.result.uid)).toEqual(["a", "b"]);
  });
});
