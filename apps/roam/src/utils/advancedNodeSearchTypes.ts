export type SearchHitSource = "semantic" | "keyword";

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

export type ScoredSearchHit = {
  result: SearchResult;
  score: number;
  source: SearchHitSource;
};

export const combineScoredSearchHits = ({
  semantic,
  keyword,
}: {
  semantic: ScoredSearchHit[];
  keyword: ScoredSearchHit[];
}): ScoredSearchHit[] => {
  const seenUids = new Set(semantic.map((hit) => hit.result.uid));
  const combined = [...semantic];

  keyword.forEach((hit) => {
    if (seenUids.has(hit.result.uid)) return;
    seenUids.add(hit.result.uid);
    combined.push(hit);
  });

  return combined;
};

export const toScoredSearchHit = ({
  uid,
  title,
  type,
  nodeTypeLabel,
  score,
  source,
  resultsByUid,
}: {
  uid: string;
  title: string;
  type?: string;
  nodeTypeLabel?: string;
  score: number;
  source: SearchHitSource;
  resultsByUid: Map<string, SearchResult>;
}): ScoredSearchHit => {
  const indexedResult = resultsByUid.get(uid);
  if (indexedResult) {
    return { result: indexedResult, score, source };
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
    source,
  };
};
