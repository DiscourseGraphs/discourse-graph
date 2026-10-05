import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  combineSemanticAndMiniSearchResults,
  MAX_RESULTS,
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

const runMiniSearchSafely = (
  runMiniSearch: () => ScoredSearchResult[],
): ScoredSearchResult[] => {
  try {
    return runMiniSearch();
  } catch {
    return [];
  }
};

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

  let results: ScoredSearchResult[];

  if (!isRoamSemanticSearchEnabled()) {
    results = runMiniSearchSafely(runMiniSearch);
  } else {
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

      results =
        providerResult.filteredResultCount >=
        SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS
          ? semanticResults
          : combineSemanticAndMiniSearchResults({
              semantic: semanticResults,
              miniSearch: runMiniSearchSafely(runMiniSearch),
            });
    } catch {
      results = runMiniSearchSafely(runMiniSearch);
    }
  }

  return results.slice(0, MAX_RESULTS);
};
