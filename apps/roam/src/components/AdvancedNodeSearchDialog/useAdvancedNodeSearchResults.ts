import { useEffect, useMemo, useState } from "react";
import MiniSearch from "minisearch";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { searchDiscourseNodes } from "~/utils/searchDiscourseNodes";
import {
  searchDiscourseNodesWithMiniSearch,
  sortSearchResults,
  type ScoredSearchResult,
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

  const [scoredResults, setScoredResults] = useState<ScoredSearchResult[]>([]);

  useEffect(() => {
    if (isDockedQuery) return;

    if (!debouncedSearchTerm) {
      setScoredResults([]);
      return;
    }

    if (isIndexLoading || indexError || !searchIndex) {
      setScoredResults([]);
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

    const runMiniSearch = (): ScoredSearchResult[] =>
      searchDiscourseNodesWithMiniSearch({
        miniSearch: searchIndex.miniSearch,
        allResults: searchIndex.allResults,
        searchTerm: debouncedSearchTerm,
        typeFilter,
      });

    void searchDiscourseNodes({
      nodeTypes: discourseNodes,
      query: debouncedSearchTerm,
      resultsByUid,
      runMiniSearch,
    })
      .then((results) => {
        if (cancelled) return;
        setScoredResults(results);
      })
      .catch((error) => {
        console.error("Advanced node search failed:", error);
        if (cancelled) return;
        setScoredResults(runMiniSearch());
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
    () => sortSearchResults({ scoredResults, sort }),
    [scoredResults, sort],
  );

  if (isDockedQuery && dockedResults) {
    return dockedResults;
  }

  return sortedLiveResults;
};
