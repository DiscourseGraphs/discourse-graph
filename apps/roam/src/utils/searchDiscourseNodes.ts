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

/** Testing only — remove or set false before merge. */
export const DEBUG_DISCOURSE_NODE_SEARCH = true;

export const logDiscourseNodeSearchResults = ({
  path,
  query,
  results,
}: {
  path: string;
  query: string;
  results: ScoredSearchResult[];
}): void => {
  if (!DEBUG_DISCOURSE_NODE_SEARCH) return;

  const semanticCount = results.filter(
    (entry) => entry.source === "semantic",
  ).length;
  const miniSearchCount = results.filter(
    (entry) => entry.source === "miniSearch",
  ).length;

  console.group(`[DG Advanced Node Search] ${path} — "${query}"`);
  console.log(
    `semantic: ${semanticCount}, miniSearch: ${miniSearchCount}, total: ${results.length}`,
  );
  console.table(
    results.map((entry) => ({
      source: entry.source,
      score: Number(entry.score.toFixed(3)),
      title: entry.result.title,
      uid: entry.result.uid,
    })),
  );
  console.groupEnd();
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

  if (!isRoamSemanticSearchEnabled()) {
    const results = runMiniSearch();
    logDiscourseNodeSearchResults({
      path: "miniSearch only (semantic disabled)",
      query: trimmedQuery,
      results,
    });
    return results;
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
      logDiscourseNodeSearchResults({
        path: "semantic only",
        query: trimmedQuery,
        results: semanticResults,
      });
      return semanticResults;
    }

    const results = combineSemanticAndMiniSearchResults({
      semantic: semanticResults,
      miniSearch: runMiniSearch(),
    });
    logDiscourseNodeSearchResults({
      path: `semantic + miniSearch fallback (< ${SEMANTIC_SEARCH_MIN_DISCOURSE_RESULTS} semantic)`,
      query: trimmedQuery,
      results,
    });
    return results;
  } catch (error) {
    console.warn("[DG Advanced Node Search] semantic API failed", error);
    const results = runMiniSearch();
    logDiscourseNodeSearchResults({
      path: "miniSearch only (semantic API error)",
      query: trimmedQuery,
      results,
    });
    return results;
  }
};
