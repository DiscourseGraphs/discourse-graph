export type DiscourseNodeSearchSource = "semantic" | "miniSearch";

export type SearchResult = {
  uid: string;
  title: string;
  type: string;
  nodeTypeLabel: string;
  excerpt: string;
  createdAt: string;
  lastModified: string;
  authorName: string;
};

export type ScoredSearchResult = {
  result: SearchResult;
  score: number;
  source: DiscourseNodeSearchSource;
  // Position in the provider's own result list, used to preserve its ordering.
  rank: number;
};

export const combineSemanticAndMiniSearchResults = ({
  semantic,
  miniSearch,
}: {
  semantic: ScoredSearchResult[];
  miniSearch: ScoredSearchResult[];
}): ScoredSearchResult[] => {
  const seenUids = new Set<string>();
  const combined: ScoredSearchResult[] = [];

  [...semantic, ...miniSearch].forEach((entry) => {
    if (seenUids.has(entry.result.uid)) return;
    seenUids.add(entry.result.uid);
    combined.push(entry);
  });

  return combined;
};

export const toScoredSearchResultFromSemantic = ({
  uid,
  title,
  type,
  nodeTypeLabel,
  score,
  rank,
  resultsByUid,
}: {
  uid: string;
  title: string;
  type?: string;
  nodeTypeLabel?: string;
  score: number;
  rank: number;
  resultsByUid: Map<string, SearchResult>;
}): ScoredSearchResult => {
  const indexedResult = resultsByUid.get(uid);
  if (indexedResult) {
    return { result: indexedResult, score, rank, source: "semantic" };
  }

  return {
    result: {
      uid,
      title,
      type: type || "",
      nodeTypeLabel: nodeTypeLabel || "",
      excerpt: "",
      createdAt: "",
      lastModified: "",
      authorName: "Unknown",
    },
    score,
    rank,
    source: "semantic",
  };
};

// Roam's semantic scores are not comparable across hits, so semantic entries keep
// the order Roam returned them in; MiniSearch entries still sort by score.
export const compareByRelevance = ({
  a,
  b,
  descending,
}: {
  a: ScoredSearchResult;
  b: ScoredSearchResult;
  descending: boolean;
}): number => {
  if (a.source !== b.source) return a.source === "semantic" ? -1 : 1;

  const comparison =
    a.source === "semantic" ? a.rank - b.rank : b.score - a.score;
  return descending ? comparison : -comparison;
};
