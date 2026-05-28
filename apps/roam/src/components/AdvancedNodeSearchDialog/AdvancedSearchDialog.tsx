import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Dialog,
  InputGroup,
  NonIdealState,
  Spinner,
  SpinnerSize,
} from "@blueprintjs/core";
import MiniSearch from "minisearch";
import posthog from "posthog-js";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import {
  insertPageRefAtRange,
  snapshotInsertTarget,
  type InsertTarget,
} from "~/utils/advancedSearchFooterUtils";
import { DiscourseNodeSortControl } from "~/components/DiscourseNodeSortControl";
import getDiscourseNodes, {
  type DiscourseNode,
} from "~/utils/getDiscourseNodes";
import { openSearchResultInMain } from "~/utils/advancedSearchNavigation";
import { openDgSearchInSidebar } from "~/utils/openDgSearchInSidebar";
import {
  DEBOUNCE_MS,
  DEFAULT_SORT_CONFIG,
  type SearchResult,
  type SortConfig,
  buildSearchIndex,
  formatMetadataDate,
  getSearchKeywords,
  searchIndexedNodes,
  sortSearchResults,
  stripTypePrefix,
} from "./utils";
import { DiscourseNodeTypeFilter } from "~/components/AdvancedNodeSearchDialog/DiscourseNodeTypeFilter";
import { RenderRoamBlock, RenderRoamPage } from "~/utils/roamReactComponents";
import { AdvancedSearchFooter } from "./AdvancedSearchFooter";
import { AdvancedSearchDialogResultsList } from "./AdvancedSearchSidebarPanel";

type Props = Record<string, unknown>;

const PreviewPane = ({ result }: { result: SearchResult | null }) => {
  if (!result) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <NonIdealState
          icon="search"
          title="Search DG nodes"
          description="Type a keyword to preview matching discourse graph nodes."
        />
      </div>
    );
  }
  const isPage = !!getPageTitleByPageUid(result.uid);

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex-none flex-row gap-2 border-b border-gray-200 px-5 py-3 text-xs text-gray-500">
        Created: {formatMetadataDate(result.createdAt)} · Last modified:{" "}
        {formatMetadataDate(result.lastModified)} · Author:{" "}
        {result.authorName || "Unknown"}
      </div>
      <div
        className="min-h-0 flex-1 overflow-y-auto border-t border-gray-200 px-5 py-3"
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className="pointer-events-none">
          {isPage ? (
            <RenderRoamPage hideMentions key={result.uid} uid={result.uid} />
          ) : (
            <RenderRoamBlock key={result.uid} uid={result.uid} zoomPath />
          )}
        </div>
      </div>
    </div>
  );
};

const AdvancedNodeSearchDialog = ({
  isOpen,
  onClose,
}: RoamOverlayProps<Props>) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [isIndexLoading, setIsIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT_CONFIG);
  const [discourseNodes, setDiscourseNodes] = useState<DiscourseNode[]>([]);
  const [selectedNodeTypeIds, setSelectedNodeTypeIds] = useState<string[]>([]);
  const miniSearchRef = useRef<MiniSearch<
    SearchResult & { id: string }
  > | null>(null);
  const allResultsRef = useRef<SearchResult[]>([]);
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [insertTarget, setInsertTarget] = useState<InsertTarget | null>(null);

  const nodeConfigByType = Object.fromEntries(
    discourseNodes.map((node) => [node.type, node]),
  );

  const activeResult = results[activeIndex] ?? null;
  const keywords = getSearchKeywords(debouncedSearchTerm);

  useEffect(() => {
    if (!isOpen) return;

    setInsertTarget(snapshotInsertTarget());

    const focusInput = () => inputRef.current?.focus();

    focusInput();
    const rafId = requestAnimationFrame(focusInput);
    const timeoutId = window.setTimeout(focusInput, 0);

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setDebouncedSearchTerm("");
      setActiveIndex(0);
      setSort(DEFAULT_SORT_CONFIG);
      setSelectedNodeTypeIds([]);
      setResults([]);
      setIndexError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (
      !isOpen ||
      isIndexLoading ||
      indexError ||
      !debouncedSearchTerm ||
      !miniSearchRef.current
    ) {
      setResults([]);
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
    isIndexLoading,
    isOpen,
    selectedNodeTypeIds,
    sort,
  ]);

  useEffect(() => {
    let cancelled = false;
    setIsIndexLoading(true);
    setIndexError(false);

    const discourseNodes = getDiscourseNodes().filter(
      (node) => node.backedBy === "user",
    );
    setDiscourseNodes(discourseNodes);

    void buildSearchIndex(discourseNodes)
      .then(({ miniSearch, results: indexedResults }) => {
        if (cancelled) return;
        miniSearchRef.current = miniSearch;
        allResultsRef.current = indexedResults;
      })
      .catch((error) => {
        console.error("Error building advanced node search index:", error);
        if (cancelled) return;
        setIndexError(true);
        renderToast({
          id: "advanced-node-search-index-error",
          content: "Failed to load discourse nodes for search.",
          intent: "danger",
        });
      })
      .finally(() => {
        if (!cancelled) setIsIndexLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearchTerm(searchTerm.trim()),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedSearchTerm, selectedNodeTypeIds, sort]);

  useEffect(() => {
    const panel = resultsPanelRef.current;
    if (!panel) return;

    const activeRow = panel.querySelector('[aria-selected="true"]');
    activeRow?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, activeResult?.uid, debouncedSearchTerm]);

  const onInsert = useCallback(async () => {
    if (!activeResult || !insertTarget) return;

    const pageTitle =
      getPageTitleByPageUid(activeResult.uid) ??
      stripTypePrefix(activeResult.title);

    await insertPageRefAtRange({
      blockUid: insertTarget.blockUid,
      pageTitle,
      selectionEnd: insertTarget.selectionEnd,
      selectionStart: insertTarget.selectionStart,
      windowId: insertTarget.windowId,
    });

    posthog.capture("Advanced Node Search: Insert", {
      uid: activeResult.uid,
      pageTitle,
    });
    onClose();
  }, [activeResult, insertTarget, onClose]);

  const contentState = indexError
    ? "error"
    : isIndexLoading
      ? "indexing"
      : !debouncedSearchTerm
        ? "initial"
        : !results.length
          ? "empty"
          : "results";

  const onOpenSearchSidebar = useCallback(async () => {
    if (contentState !== "results" || !results.length) return;

    try {
      await openDgSearchInSidebar({
        query: debouncedSearchTerm,
        results,
        selectedNodeTypeIds,
        sort,
      });

      posthog.capture("Advanced Node Search: Dock search sidebar", {
        resultCount: results.length,
        searchTerm: debouncedSearchTerm,
        selectedNodeTypeCount: selectedNodeTypeIds.length,
        sortDirection: sort.direction,
        sortField: sort.field,
      });
      onClose();
    } catch (error) {
      console.error("Failed to dock search results in the sidebar:", error);
      renderToast({
        id: "advanced-node-search-sidebar-open-error",
        content: "Could not dock search results in the right sidebar.",
        intent: "danger",
      });
    }
  }, [
    contentState,
    debouncedSearchTerm,
    onClose,
    results,
    selectedNodeTypeIds,
    sort,
  ]);
  const handleSortChange = useCallback((nextSort: SortConfig): void => {
    setSort(nextSort);
  }, []);

  const onOpen = useCallback(async () => {
    if (!activeResult || contentState !== "results") return;

    await openSearchResultInMain(activeResult.uid);
    onClose();
  }, [activeResult, contentState, onClose]);

  const onOpenInSidebar = useCallback(async () => {
    if (!activeResult || contentState !== "results") return;

    await window.roamAlphaAPI.ui.rightSidebar.addWindow({
      window: {
        type: "outline",
        // @ts-expect-error - block-uid is valid for outline sidebar windows
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "block-uid": activeResult.uid,
      },
    });
    onClose();
  }, [activeResult, contentState, onClose]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown" && results.length) {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      } else if (event.key === "ArrowUp" && results.length) {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (
        event.key === "Enter" &&
        event.altKey &&
        contentState === "results" &&
        results.length
      ) {
        event.preventDefault();
        void onOpenSearchSidebar();
      } else if (
        event.key === "Enter" &&
        !event.metaKey &&
        !event.ctrlKey &&
        contentState === "results" &&
        activeResult
      ) {
        event.preventDefault();
        if (event.shiftKey) void onOpenInSidebar();
        else void onOpen();
      } else if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        contentState === "results" &&
        activeResult &&
        insertTarget
      ) {
        event.preventDefault();
        void onInsert();
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [
      activeResult,
      contentState,
      insertTarget,
      onClose,
      onOpenSearchSidebar,
      onInsert,
      onOpen,
      onOpenInSidebar,
      results.length,
    ],
  );

  const showSplitView = contentState === "results";

  return (
    <Dialog
      autoFocus={false}
      canEscapeKeyClose
      canOutsideClickClose
      className="flex max-w-4xl flex-col overflow-hidden bg-white p-0"
      enforceFocus={false}
      isOpen={isOpen}
      onClose={onClose}
      style={{
        height: "72vh",
        width: "min(56rem, calc(100vw - 64px))",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="flex flex-none items-center gap-2 border-b border-gray-200 px-3 py-2">
          <InputGroup
            fill
            inputRef={inputRef}
            leftIcon="search"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search discourse nodes..."
            value={searchTerm}
          />
          <DiscourseNodeTypeFilter
            nodeTypes={discourseNodes}
            onSelectedTypeIdsChange={setSelectedNodeTypeIds}
            selectedTypeIds={selectedNodeTypeIds}
          />
          <DiscourseNodeSortControl
            disabled={isIndexLoading || indexError}
            onSortChange={handleSortChange}
            sort={sort}
          />
          <Button
            className="shrink-0"
            icon="cross"
            minimal
            onClick={onClose}
            title="Close search"
          />
        </div>
        <div className="flex min-h-0 w-full flex-1 overflow-hidden">
          {showSplitView ? (
            <>
              <div
                aria-label="Search results"
                className="w-1/3 shrink-0 overflow-y-auto border-r border-gray-200 py-1"
                ref={resultsPanelRef}
                role="listbox"
              >
                <AdvancedSearchDialogResultsList
                  activeIndex={activeIndex}
                  keywords={keywords}
                  nodeConfigByType={nodeConfigByType}
                  onSelect={setActiveIndex}
                  results={results}
                />
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <PreviewPane result={activeResult} />
              </div>
            </>
          ) : (
            <div className="flex min-h-0 w-full flex-1 items-center justify-center px-4 py-8 text-center text-sm text-gray-500">
              {contentState === "indexing" && (
                <Spinner size={SpinnerSize.SMALL} />
              )}
              {contentState === "empty" && (
                <span>No matches. Try another keyword.</span>
              )}
              {contentState === "error" && (
                <span>
                  Search unavailable. Reload the extension and try again.
                </span>
              )}
            </div>
          )}
        </div>
        <AdvancedSearchFooter
          contentState={contentState}
          hasActiveResult={!!activeResult}
          insertTarget={insertTarget}
          onInsert={() => void onInsert()}
          onOpen={() => void onOpen()}
          onOpenInSidebar={() => void onOpenInSidebar()}
          onOpenSearchSidebar={() => void onOpenSearchSidebar()}
        />
      </div>
    </Dialog>
  );
};

export const renderAdvancedNodeSearchSidebar = () =>
  renderOverlay({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Overlay: AdvancedNodeSearchDialog,
    props: {},
  });

export const renderAdvancedNodeSearchDialog = () =>
  renderAdvancedNodeSearchSidebar();
