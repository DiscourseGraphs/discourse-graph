import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  combineScoredSearchHits,
  toScoredSearchHit,
  type ScoredSearchHit,
  type SearchResult,
} from "~/utils/advancedNodeSearchTypes";
import { runRoamSemanticSearch } from "~/utils/discourseNodeSearchProviders";

export const SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS = 5;

export type {
  ScoredSearchHit,
  SearchResult,
  SearchHitSource,
} from "~/utils/advancedNodeSearchTypes";

export const shouldUseRoamSemanticSearch = (): boolean =>
  window.roamAlphaAPI.data.semanticSearchEnabled();

export const searchDiscourseNodesWithSemanticFallback = async ({
  nodeTypes,
  query,
  resultsByUid,
  runKeywordSearch,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
  resultsByUid: Map<string, SearchResult>;
  runKeywordSearch: () => ScoredSearchHit[];
}): Promise<ScoredSearchHit[]> => {
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
    const semanticHits = providerResult.filteredResults.map((item) =>
      toScoredSearchHit({
        uid: item.uid,
        title: item.text,
        type: item.type,
        nodeTypeLabel: item.nodeTypeLabel,
        score: item.score ?? 0,
        source: "semantic",
        resultsByUid,
      }),
    );

    if (
      providerResult.filteredResultCount >=
      SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS
    ) {
      return semanticHits;
    }

    return combineScoredSearchHits({
      semantic: semanticHits,
      keyword: runKeywordSearch(),
    });
  } catch {
    return runKeywordSearch();
  }
};
