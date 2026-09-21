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
  // An empty persisted result set is not a usable cache: the docked panel also
  // persists the transient [] published while an async search is in flight.
  const hasUsableDockedResults = useMemo(
    () =>
      dockedQuery !== undefined &&
      debouncedSearchTerm.trim() === dockedQuery.trim() &&
      !!dockedResults &&
      dockedResults.length > 0,
    [debouncedSearchTerm, dockedQuery, dockedResults],
  );

  const [unsortedScoredResults, setUnsortedScoredResults] = useState<
    ScoredSearchResult[]
  >([]);

  useEffect(() => {
    if (hasUsableDockedResults) {
      setUnsortedScoredResults([]);
      return;
    }

    if (!debouncedSearchTerm) {
      setUnsortedScoredResults([]);
      return;
    }

    if (isIndexLoading || indexError || !searchIndex) {
      setUnsortedScoredResults([]);
      return;
    }

    setUnsortedScoredResults([]);
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
        setUnsortedScoredResults(results);
      })
      .catch(() => {
        if (cancelled) return;
        setUnsortedScoredResults(runMiniSearch());
      });

    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearchTerm,
    hasUsableDockedResults,
    indexError,
    isIndexLoading,
    searchIndex,
    selectedNodeTypeIds,
  ]);

  const results = useMemo(
    () => sortSearchResults({ scoredResults: unsortedScoredResults, sort }),
    [unsortedScoredResults, sort],
  );

  if (hasUsableDockedResults && dockedResults) {
    return dockedResults;
  }

  return results;
};
