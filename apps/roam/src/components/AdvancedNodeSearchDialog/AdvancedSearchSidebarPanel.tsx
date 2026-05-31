import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Icon,
  InputGroup,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from "@blueprintjs/core";
import MiniSearch from "minisearch";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import type { DockedSearchState } from "~/utils/openDgSearchInSidebar";
import {
  DEBOUNCE_MS,
  type SearchResult,
  buildSearchIndex,
  getSearchKeywords,
  searchIndexedNodes,
  sortSearchResults,
} from "./utils";
import { hasActiveTypeFilter } from "~/utils/discourseNodeTypeFilter";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { SORT_FIELD_LABELS, isNonDefaultSort, type SortConfig } from "./utils";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import type { DiscourseNode } from "~/utils/getDiscourseNodes";
import { getNodeTagStyles } from "~/utils/getDiscourseNodeColors";
import { splitWithHighlights, stripTypePrefix } from "./utils";
import { openSearchResultFromLinkEvent } from "~/utils/advancedSearchFooterUtils";

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

const getNodeBadgeText = (node: DiscourseNode): string =>
  (node.tag?.trim() || node.text).slice(0, 3).toUpperCase();

const getTagStyle = (node: DiscourseNode | undefined): React.CSSProperties => {
  const color = node?.canvasSettings?.color;
  if (!color) return { flexShrink: 0 };
  return { ...getNodeTagStyles(color), flexShrink: 0 };
};

type AdvancedSearchDialogResultsListProps = {
  activeIndex: number;
  keywords: string[];
  nodeConfigByType: Record<string, DiscourseNode>;
  onSelect: (index: number) => void;
  results: SearchResult[];
};

export const AdvancedSearchDialogResultsList = ({
  activeIndex,
  keywords,
  nodeConfigByType,
  onSelect,
  results,
}: AdvancedSearchDialogResultsListProps) => (
  <>
    {results.map((result, index) => (
      <Button
        alignText="left"
        aria-selected={index === activeIndex}
        className="flex-none !items-start gap-2 !px-3 !py-2"
        fill
        key={result.uid}
        minimal
        onClick={() => onSelect(index)}
        onMouseEnter={() => onSelect(index)}
        role="option"
        style={{
          background:
            index === activeIndex ? "rgba(95, 87, 192, 0.08)" : undefined,
          boxShadow:
            index === activeIndex ? "inset 3px 0 0 #5f57c0" : undefined,
        }}
      >
        <Tag
          className="shrink-0"
          minimal
          style={getTagStyle(nodeConfigByType[result.type])}
        >
          {nodeConfigByType[result.type]
            ? getNodeBadgeText(nodeConfigByType[result.type])
            : result.nodeTypeLabel}
        </Tag>
        <span className="min-w-0 break-words text-sm leading-snug text-gray-900">
          {renderHighlightedText(stripTypePrefix(result.title), keywords)}
        </span>
      </Button>
    ))}
  </>
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
                  void openSearchResultFromLinkEvent({
                    shiftKey: true,
                    uid: result.uid,
                  });
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

type SidebarIndexCache = {
  miniSearch: MiniSearch<SearchResult & { id: string }>;
  results: SearchResult[];
};

let cachedSidebarIndex: SidebarIndexCache | null = null;

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
    <div className="dg-node-search-sidebar__filters mb-1 ml-[9px] mr-2 flex flex-col gap-1.5">
      {isTypeFilterActive && (
        <div className="mt-1 flex flex-wrap items-center gap-1">
          <span className="shrink-0 text-[0.8em] text-gray-500">
            Filtered to
          </span>
          {selectedNodes.map((node) => (
            <Tag
              className="!text-[0.8em]"
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
        <p className="text-[0.8em] text-gray-500">
          Sorted by {SORT_FIELD_LABELS[sort.field]} (
          {sort.direction === "asc" ? "ascending" : "descending"})
        </p>
      )}
    </div>
  );
};

type AdvancedSearchSidebarPanelProps = {
  dockedState: DockedSearchState;
};

export const AdvancedSearchSidebarPanel = ({
  dockedState,
}: AdvancedSearchSidebarPanelProps) => {
  const {
    query,
    results: dockedResults,
    selectedNodeTypeIds,
    sort,
  } = dockedState;

  const [searchTerm, setSearchTerm] = useState(query);
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(query);
  const [results, setResults] = useState<SearchResult[]>(dockedResults);
  const [isIndexLoading, setIsIndexLoading] = useState(true);
  const [indexError, setIndexError] = useState(false);

  const miniSearchRef = useRef<MiniSearch<
    SearchResult & { id: string }
  > | null>(null);
  const allResultsRef = useRef<SearchResult[]>([]);

  const discourseNodes = useMemo(
    () => getDiscourseNodes().filter((node) => node.backedBy === "user"),
    [],
  );
  const keywords = getSearchKeywords(debouncedSearchTerm);
  const isDockedQuery = debouncedSearchTerm.trim() === query.trim();

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

    const applyIndex = ({
      miniSearch,
      results: indexedResults,
    }: SidebarIndexCache): void => {
      if (cancelled) return;
      miniSearchRef.current = miniSearch;
      allResultsRef.current = indexedResults;
      setIsIndexLoading(false);
    };

    if (cachedSidebarIndex) {
      applyIndex(cachedSidebarIndex);
      return () => {
        cancelled = true;
      };
    }

    void buildSearchIndex(discourseNodes)
      .then(({ miniSearch, results: indexedResults }) => {
        cachedSidebarIndex = {
          miniSearch,
          results: indexedResults,
        };
        applyIndex(cachedSidebarIndex);
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

  useEffect(() => {
    if (!debouncedSearchTerm) {
      setResults([]);
      return;
    }

    if (isIndexLoading || indexError || !miniSearchRef.current) {
      if (!isDockedQuery) setResults([]);
      return;
    }

    const scoredHits = searchIndexedNodes({
      miniSearch: miniSearchRef.current,
      allResults: allResultsRef.current,
      searchTerm: debouncedSearchTerm,
      typeFilter: selectedNodeTypeIds.length ? selectedNodeTypeIds : undefined,
    });

    setResults(sortSearchResults({ hits: scoredHits, sort }));
  }, [
    debouncedSearchTerm,
    indexError,
    isDockedQuery,
    isIndexLoading,
    selectedNodeTypeIds,
    sort,
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
            <span className="ml-[9px] text-[0.9em]">
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
