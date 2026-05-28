import React, { useEffect, useRef, useState } from "react";
import { NonIdealState, Spinner, SpinnerSize } from "@blueprintjs/core";
import MiniSearch from "minisearch";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import {
  DEBOUNCE_MS,
  type SearchResult,
  type SortConfig,
  buildSearchIndex,
  searchIndexedNodes,
  sortSearchResults,
} from "./utils";
import type { AdvancedNodeSearchSession } from "~/utils/openDgSearchInSidebar";
import { AdvancedSearchSidebarResultsList } from "./AdvancedSearchResultsList";

type AdvancedSearchSidebarPanelProps = {
  initialSession: AdvancedNodeSearchSession;
};

export const AdvancedSearchSidebarPanel = ({
  initialSession,
}: AdvancedSearchSidebarPanelProps) => {
  const [searchTerm, setSearchTerm] = useState(initialSession.query);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(
    initialSession.query,
  );
  const [sort] = useState<SortConfig>(initialSession.sort);
  const [results, setResults] = useState<SearchResult[]>(
    initialSession.results,
  );
  const [isIndexLoading, setIsIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState(false);

  const miniSearchRef = useRef<MiniSearch<
    SearchResult & { id: string }
  > | null>(null);
  const allResultsRef = useRef<SearchResult[]>([]);

  const keywords = debouncedSearchTerm.split(/\s+/).filter(Boolean);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearchTerm(searchTerm.trim()),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    let cancelled = false;
    setIsIndexLoading(true);
    setIndexError(false);

    const discourseNodes = getDiscourseNodes().filter(
      (node) => node.backedBy === "user",
    );

    void buildSearchIndex(discourseNodes)
      .then(({ miniSearch, results: indexedResults }) => {
        if (cancelled) return;
        miniSearchRef.current = miniSearch;
        allResultsRef.current = indexedResults;
      })
      .catch((error) => {
        console.error(
          "Error building advanced node search sidebar index:",
          error,
        );
        if (!cancelled) setIndexError(true);
      })
      .finally(() => {
        if (!cancelled) setIsIndexLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (
      isIndexLoading ||
      indexError ||
      !debouncedSearchTerm ||
      !miniSearchRef.current
    ) {
      if (!debouncedSearchTerm) setResults([]);
      return;
    }

    const scoredHits = searchIndexedNodes({
      miniSearch: miniSearchRef.current,
      allResults: allResultsRef.current,
      searchTerm: debouncedSearchTerm,
    });

    setResults(sortSearchResults({ hits: scoredHits, sort }));
  }, [debouncedSearchTerm, indexError, isIndexLoading, sort]);

  const resultLabel =
    results.length === 1 ? "1 result" : `${results.length} results`;

  return (
    <div className="dg-node-search-sidebar rm-sidebar-search box-border w-full min-w-0">
      <div className="dg-node-search-sidebar__input-row -ml-2 mr-2 box-border flex w-full min-w-0 items-center">
        <input
          className="bp3-input dg-node-search-sidebar__input box-border block w-full min-w-0 max-w-full"
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search discourse nodes..."
          type="text"
          value={searchTerm}
        />
      </div>
      <div className="rm-reference-main rm-search-query-content">
        {indexError ? (
          <NonIdealState
            icon="error"
            title="Search unavailable"
            description="Reload the extension and try again."
          />
        ) : (
          <>
            <span className="ml-[9px] text-[0.9em]">
              {isIndexLoading && !results.length
                ? "Loading…"
                : debouncedSearchTerm
                  ? resultLabel
                  : "Type to search"}
            </span>
            {isIndexLoading && !results.length ? (
              <div className="flex justify-center py-4">
                <Spinner size={SpinnerSize.SMALL} />
              </div>
            ) : (
              <>
                {debouncedSearchTerm && results.length > 0 && (
                  <AdvancedSearchSidebarResultsList
                    keywords={keywords}
                    results={results}
                  />
                )}
                {debouncedSearchTerm && !results.length && !isIndexLoading && (
                  <p className="px-2 py-3 text-sm text-gray-500">
                    No matches. Try another keyword.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
