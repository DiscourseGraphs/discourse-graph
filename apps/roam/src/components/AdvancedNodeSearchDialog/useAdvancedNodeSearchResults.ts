import { useEffect, useMemo, useState } from "react";
import MiniSearch from "minisearch";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { searchDiscourseNodesWithSemanticFallback } from "~/utils/discourseNodeSemanticSearch";
import {
  searchIndexedNodes,
  sortSearchResults,
  type ScoredSearchHit,
  type SearchResult,
  type SortConfig,
} from "./utils";

export type SearchIndex = {
  miniSearch: MiniSearch<SearchResult & { id: string }>;
  allResults: SearchResult[];
};

type UseAdvancedNodeSearchResultsArgs = {
  debouncedSearchTerm: string;
  selectedNodeTypeIds: string[];
  sort: SortConfig;
  isIndexLoading: boolean;
  indexError: boolean;
  searchIndex: SearchIndex | null;
  dockedQuery?: string;
  dockedResults?: SearchResult[];
};

export const useAdvancedNodeSearchResults = ({
  debouncedSearchTerm,
  selectedNodeTypeIds,
  sort,
  isIndexLoading,
  indexError,
  searchIndex,
  dockedQuery,
  dockedResults,
}: UseAdvancedNodeSearchResultsArgs): SearchResult[] => {
  const isDockedQuery = useMemo(
    () =>
      dockedQuery !== undefined &&
      debouncedSearchTerm.trim() === dockedQuery.trim(),
    [debouncedSearchTerm, dockedQuery],
  );

  const [scoredHits, setScoredHits] = useState<ScoredSearchHit[]>([]);

  useEffect(() => {
    if (isDockedQuery) return;

    if (!debouncedSearchTerm) {
      setScoredHits([]);
      return;
    }

    if (isIndexLoading || indexError || !searchIndex) {
      setScoredHits([]);
      return;
    }

    let cancelled = false;
    const typeFilter = selectedNodeTypeIds.length
      ? selectedNodeTypeIds
      : undefined;
    const discourseNodes = getDiscourseNodes().filter(
      (node) =>
        node.backedBy === "user" &&
        (!typeFilter || typeFilter.includes(node.type)),
    );
    const resultsByUid = new Map(
      searchIndex.allResults.map((result) => [result.uid, result]),
    );

    const runKeywordSearch = (): ScoredSearchHit[] =>
      searchIndexedNodes({
        miniSearch: searchIndex.miniSearch,
        allResults: searchIndex.allResults,
        searchTerm: debouncedSearchTerm,
        typeFilter,
      });

    void searchDiscourseNodesWithSemanticFallback({
      nodeTypes: discourseNodes,
      query: debouncedSearchTerm,
      resultsByUid,
      runKeywordSearch,
    })
      .then((hits) => {
        if (cancelled) return;
        setScoredHits(hits);
      })
      .catch((error) => {
        console.error("Advanced node search failed:", error);
        if (cancelled) return;
        setScoredHits(runKeywordSearch());
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearchTerm,
    indexError,
    isDockedQuery,
    isIndexLoading,
    searchIndex,
    selectedNodeTypeIds,
  ]);

  const sortedLiveResults = useMemo(
    () => sortSearchResults({ hits: scoredHits, sort }),
    [scoredHits, sort],
  );

  if (isDockedQuery && dockedResults) {
    return dockedResults;
  }

  return sortedLiveResults;
};
