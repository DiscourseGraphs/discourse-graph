import React, { useEffect, useMemo, useState } from "react";
import {
  Icon,
  InputGroup,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from "@blueprintjs/core";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import {
  DEBOUNCE_MS,
  type DockedSearchState,
  type SearchResult,
  buildSearchIndex,
  getSearchKeywords,
} from "./utils";
import { hasActiveTypeFilter } from "~/utils/discourseNodeTypeFilter";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { SORT_FIELD_LABELS, isNonDefaultSort, type SortConfig } from "./utils";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { splitWithHighlights, stripTypePrefix } from "./utils";
import {
  type SearchIndex,
  useAdvancedNodeSearchResults,
} from "./useAdvancedNodeSearchResults";

const renderHighlightedText = (
  text: string,
  keywords: string[],
): React.ReactNode =>
  splitWithHighlights(text, keywords).map((segment, index) =>
    segment.isMatch ? (
      <mark key={`${segment.text}-${index}`}>{segment.text}</mark>
    ) : (
      <React.Fragment key={`${segment.text}-${index}`}>
        {segment.text}
      </React.Fragment>
    ),
  );

type AdvancedSearchSidebarResultsListProps = {
  keywords: string[];
  results: SearchResult[];
};

export const AdvancedSearchSidebarResultsList = ({
  keywords,
  results,
}: AdvancedSearchSidebarResultsListProps) => (
  <>
    {results.map((result) => {
      const displayTitle = stripTypePrefix(result.title);

      return (
        <div
          className="rm-search-query__page-row dont-focus-block"
          key={result.uid}
        >
          <Icon
            className="rm-search-query__page-row-icon"
            icon="document"
            iconSize={16}
          />
          <span className="rm-search-query__page-row-title">
            <a
              className="rm-page-ref rm-page-ref--link"
              data-link-title={displayTitle}
              data-link-uid={result.uid}
              href={getRoamUrl(result.uid)}
              onMouseDown={(event) => {
                if (event.shiftKey) {
                  event.preventDefault();
                  event.stopPropagation();
                  void openBlockInSidebar(result.uid);
                }
              }}
              onClick={(event) => {
                if (event.shiftKey) {
                  event.preventDefault();
                  event.stopPropagation();
                }
              }}
            >
              <span className="rm-page__title cursor-pointer">
                {renderHighlightedText(displayTitle, keywords)}
              </span>
            </a>
          </span>
        </div>
      );
    })}
  </>
);

type AdvancedSearchDockedFiltersProps = {
  discourseNodes: DiscourseNode[];
  selectedNodeTypeIds: string[];
  sort: SortConfig;
};

const getNodeIndicatorColor = (node: DiscourseNode): string =>
  formatHexColor(node.canvasSettings?.color) || "#6b7280";

const AdvancedSearchDockedFilters = ({
  discourseNodes,
  selectedNodeTypeIds,
  sort,
}: AdvancedSearchDockedFiltersProps): React.ReactElement | null => {
  const allTypeIds = discourseNodes.map((node) => node.type);
  const isTypeFilterActive = hasActiveTypeFilter({
    selectedTypeIds: selectedNodeTypeIds,
    allTypeIds,
  });
  const selectedNodes = isTypeFilterActive
    ? discourseNodes.filter((node) => selectedNodeTypeIds.includes(node.type))
    : [];
  const showSort = isNonDefaultSort(sort);

  if (!isTypeFilterActive && !showSort) return null;

  return (
    <div className="dg-node-search-sidebar__filters mb-1 ml-2 mr-2 flex flex-col gap-1.5">
      {isTypeFilterActive && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="shrink-0 text-xs text-gray-500">Filter:</span>
          {selectedNodes.map((node) => (
            <Tag
              className="!text-xs"
              key={node.type}
              minimal
              round
              style={{
                backgroundColor: "rgba(95, 87, 192, 0.08)",
                color: "#374151",
              }}
            >
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: getNodeIndicatorColor(node) }}
                />
                {node.text}
              </span>
            </Tag>
          ))}
        </div>
      )}
      {showSort && (
        <p className="text-xs text-gray-500">
          Sorted by {SORT_FIELD_LABELS[sort.field]} (
          {sort.direction === "asc" ? "ascending" : "descending"})
        </p>
      )}
    </div>
  );
};

type AdvancedSearchSidebarPanelProps = {
  dgSearchId: string;
  dockedState: DockedSearchState;
  onPersistState: (state: DockedSearchState) => void;
  windowId: string;
};

export const AdvancedSearchSidebarPanel = ({
  dgSearchId,
  dockedState,
  onPersistState,
  windowId,
}: AdvancedSearchSidebarPanelProps) => {
  const {
    query,
    results: dockedResults,
    selectedNodeTypeIds,
    sort,
  } = dockedState;

  const [searchTerm, setSearchTerm] = useState(query);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(query);
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [isIndexLoading, setIsIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState(false);

  const discourseNodes = useMemo(
    () => getDiscourseNodes().filter((node) => node.backedBy === "user"),
    [],
  );
  const keywords = getSearchKeywords(debouncedSearchTerm);

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
    setSearchIndex(null);

    void buildSearchIndex(discourseNodes)
      .then(({ miniSearch, results: indexedResults }) => {
        if (cancelled) return;
        setSearchIndex({ miniSearch, allResults: indexedResults });
        setIsIndexLoading(false);
      })
      .catch((error) => {
        console.error(
          "Error building advanced node search sidebar index:",
          error,
        );
        if (!cancelled) {
          setIndexError(true);
          setIsIndexLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [discourseNodes]);

  const results = useAdvancedNodeSearchResults({
    debouncedSearchTerm,
    selectedNodeTypeIds,
    sort,
    isIndexLoading,
    indexError,
    searchIndex,
    dockedQuery: query,
    dockedResults,
  });

  useEffect(() => {
    onPersistState({
      query: debouncedSearchTerm,
      results,
      selectedNodeTypeIds,
      sort,
      windowId,
      dgSearchId,
    });
  }, [
    debouncedSearchTerm,
    dgSearchId,
    onPersistState,
    results,
    selectedNodeTypeIds,
    sort,
    windowId,
  ]);

  const resultLabel =
    results.length === 1 ? "1 result" : `${results.length} results`;

  return (
    <div className="dg-node-search-sidebar box-border w-full min-w-0">
      <div className="dg-node-search-sidebar__input-row -ml-2 mr-2 box-border flex w-full min-w-0 items-center">
        <InputGroup
          className="dg-node-search-sidebar__input box-border block w-full min-w-0 max-w-full"
          fill
          leftIcon="search"
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search discourse nodes..."
          value={searchTerm}
        />
      </div>
      {debouncedSearchTerm && (
        <AdvancedSearchDockedFilters
          discourseNodes={discourseNodes}
          selectedNodeTypeIds={selectedNodeTypeIds}
          sort={sort}
        />
      )}
      <div className="rm-reference-main rm-search-query-content">
        {indexError ? (
          <NonIdealState
            icon="error"
            title="Search unavailable"
            description="Reload the extension and try again."
          />
        ) : (
          <>
            <span className="ml-2 text-xs">
              {isIndexLoading && !results.length
                ? "Loading…"
                : debouncedSearchTerm
                  ? `${resultLabel} for “${debouncedSearchTerm}”`
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
