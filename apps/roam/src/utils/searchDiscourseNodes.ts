import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  combineSemanticAndMiniSearchResults,
  toScoredSearchResultFromSemantic,
  type ScoredSearchResult,
  type SearchResult,
} from "~/utils/discourseNodeSearchTypes";
import { runRoamSemanticSearch } from "~/utils/discourseNodeSearchProviders";

export const SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS = 5;

export type {
  DiscourseNodeSearchSource,
  ScoredSearchResult,
  SearchResult,
} from "~/utils/discourseNodeSearchTypes";

export const isRoamSemanticSearchEnabled = (): boolean =>
  window.roamAlphaAPI.data.semanticSearchEnabled();

export const searchDiscourseNodes = async ({
  nodeTypes,
  query,
  resultsByUid,
  runMiniSearch,
}: {
  nodeTypes: DiscourseNode[];
  query: string;
  resultsByUid: Map<string, SearchResult>;
  runMiniSearch: () => ScoredSearchResult[];
}): Promise<ScoredSearchResult[]> => {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return [];

  if (!isRoamSemanticSearchEnabled()) {
    return runMiniSearch();
  }

  try {
    const providerResult = await runRoamSemanticSearch({
      nodeTypes,
      query: trimmedQuery,
    });
    const semanticResults = providerResult.filteredResults.map((item) =>
      toScoredSearchResultFromSemantic({
        uid: item.uid,
        title: item.text,
        type: item.type,
        nodeTypeLabel: item.nodeTypeLabel,
        score: item.score ?? 0,
        resultsByUid,
      }),
    );

    if (
      providerResult.filteredResultCount >=
      SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS
    ) {
      return semanticResults;
    }

    return combineSemanticAndMiniSearchResults({
      semantic: semanticResults,
      miniSearch: runMiniSearch(),
    });
  } catch {
    return runMiniSearch();
  }
};
