import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  runRoamSemanticSearch,
  type AdminSearchResultItem,
} from "~/utils/discourseNodeSearchProviders";

export const SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS = 5;

export type DiscourseSearchHitSource = "semantic" | "keyword";

export type DiscourseSearchHit = {
  uid: string;
  text: string;
  type?: string;
  nodeTypeLabel?: string;
  score: number;
  source: DiscourseSearchHitSource;
};

export const shouldUseRoamSemanticSearch = (): boolean =>
  window.roamAlphaAPI.data.semanticSearchEnabled();

export const combineDiscourseSearchResults = ({
  semantic,
  keyword,
}: {
  semantic: DiscourseSearchHit[];
  keyword: DiscourseSearchHit[];
}): DiscourseSearchHit[] => {
  const seenUids = new Set(semantic.map((hit) => hit.uid));
  const combined = [...semantic];

  keyword.forEach((hit) => {
    if (seenUids.has(hit.uid)) return;
    seenUids.add(hit.uid);
    combined.push(hit);
  });

  return combined;
};

const toSemanticHit = (item: AdminSearchResultItem): DiscourseSearchHit => ({
  uid: item.uid,
  text: item.text,
  type: item.type,
  nodeTypeLabel: item.nodeTypeLabel,
  score: item.score ?? 0,
  source: "semantic",
});

export const searchDiscourseNodesWithSemanticFallback = async ({
  nodeTypes,
  query,
  runKeywordSearch,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
  runKeywordSearch: () => DiscourseSearchHit[];
}): Promise<DiscourseSearchHit[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  if (!shouldUseRoamSemanticSearch()) {
    return runKeywordSearch();
  }

  try {
    const providerResult = await runRoamSemanticSearch({
      nodeTypes,
      query: trimmedQuery,
    });
    const semanticHits = providerResult.filteredResults.map(toSemanticHit);

    if (
      providerResult.filteredResultCount >=
      SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS
    ) {
      return semanticHits;
    }

    return combineDiscourseSearchResults({
      semantic: semanticHits,
      keyword: runKeywordSearch(),
    });
  } catch {
    return runKeywordSearch();
  }
};
