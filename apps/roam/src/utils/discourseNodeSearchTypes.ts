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
};

export const combineSemanticAndMiniSearchResults = ({
  semantic,
  miniSearch,
}: {
  semantic: ScoredSearchResult[];
  miniSearch: ScoredSearchResult[];
}): ScoredSearchResult[] => {
  const seenUids = new Set(semantic.map((entry) => entry.result.uid));
  const combined = [...semantic];

  miniSearch.forEach((entry) => {
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
  resultsByUid,
}: {
  uid: string;
  title: string;
  type?: string;
  nodeTypeLabel?: string;
  score: number;
  resultsByUid: Map<string, SearchResult>;
}): ScoredSearchResult => {
  const indexedResult = resultsByUid.get(uid);
  if (indexedResult) {
    return { result: indexedResult, score, source: "semantic" };
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
    source: "semantic",
  };
};
