import { useMemo } from "react";
import MiniSearch from "minisearch";
import {
  searchIndexedNodes,
  sortSearchResults,
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
}: UseAdvancedNodeSearchResultsArgs): SearchResult[] =>
  useMemo(() => {
    if (!debouncedSearchTerm) return [];

    const isDockedQuery =
      dockedQuery !== undefined &&
      debouncedSearchTerm.trim() === dockedQuery.trim();

    if (isDockedQuery && dockedResults) {
      return dockedResults;
    }

    if (isIndexLoading || indexError || !searchIndex) {
      return [];
    }

    const scoredHits = searchIndexedNodes({
      miniSearch: searchIndex.miniSearch,
      allResults: searchIndex.allResults,
      searchTerm: debouncedSearchTerm,
      typeFilter: selectedNodeTypeIds.length ? selectedNodeTypeIds : undefined,
    });

    return sortSearchResults({ hits: scoredHits, sort });
  }, [
    debouncedSearchTerm,
    dockedQuery,
    dockedResults,
    indexError,
    isIndexLoading,
    searchIndex,
    selectedNodeTypeIds,
    sort,
  ]);
