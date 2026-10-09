import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Dialog,
  Icon,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from "@blueprintjs/core";
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
import { getCandidateTagTitle } from "~/utils/discourseNodeSearch";
import getDiscourseNodes, {
  type DiscourseNode,
} from "~/utils/getDiscourseNodes";
import { getNodeTagStyles } from "~/utils/getDiscourseNodeColors";
import { revealBlockInPreview } from "./revealBlockInPreview";
import { mountAdvancedSearchInSidebar } from "./mountAdvancedSearchInSidebar";
import {
  DEBOUNCE_MS,
  DEFAULT_SORT_CONFIG,
  type SearchResult,
  type SortConfig,
  buildSearchIndex,
  formatBadgeText,
  formatMetadataDate,
  getSearchKeywords,
  splitWithHighlights,
  stripTypePrefix,
} from "./utils";
import { DiscourseNodeTypeFilter } from "~/components/AdvancedNodeSearchDialog/DiscourseNodeTypeFilter";
import { RenderRoamBlock, RenderRoamPage } from "~/utils/roamReactComponents";
import { AdvancedSearchFooter } from "./AdvancedSearchFooter";
import { DisplayOptionsMenu } from "./DisplayOptionsMenu";
import { NodeTypeChipsSearchInput } from "./NodeTypeChipsSearchInput";
import {
  type SearchIndex,
  useAdvancedNodeSearchResults,
} from "./useAdvancedNodeSearchResults";

type Props = Record<string, unknown>;

const getNodeBadgeText = (node: DiscourseNode): string => {
  return formatBadgeText(node.tag?.trim() || node.text);
};

const getTagStyle = ({
  isCandidate,
  node,
}: {
  isCandidate?: boolean;
  node: DiscourseNode | undefined;
}): React.CSSProperties => {
  const color = node?.canvasSettings?.color;
  if (!color) return { flexShrink: 0 };
  return {
    ...getNodeTagStyles(color),
    ...(isCandidate && { backgroundColor: "transparent", boxShadow: "none" }),
    flexShrink: 0,
  };
};

// Mirrors Obsidian's "#tag · note · line" line under a candidate's title.
const getCandidateSubtitle = ({
  candidate,
  nodeConfigByType,
}: {
  candidate: NonNullable<SearchResult["candidate"]>;
  nodeConfigByType: Record<string, DiscourseNode>;
}): string => {
  const tags = candidate.nodeTypes
    .map((type) => nodeConfigByType[type]?.tag)
    .filter((tag): tag is string => !!tag?.trim())
    .map((tag) => `#${getCandidateTagTitle(tag)}`);
  return [tags.join(" "), candidate.pageTitle].filter(Boolean).join(" · ");
};

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

const ResultRow = ({
  active,
  keywords,
  nodeConfig,
  onClick,
  onMouseEnter,
  result,
  subtitle,
}: {
  active: boolean;
  keywords: string[];
  nodeConfig: DiscourseNode | undefined;
  onClick: () => void;
  onMouseEnter: () => void;
  result: SearchResult;
  subtitle?: string;
}) => (
  <Button
    alignText="left"
    aria-selected={active}
    className="flex-none !items-start !px-3 !py-2"
    fill
    minimal
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    role="option"
    style={{
      background: active ? "rgba(167, 182, 194, 0.3)" : undefined,
      boxShadow: active ? "inset 3px 0 0 rgba(167, 182, 194, 0.3)" : undefined,
    }}
  >
    {/* Blueprint wraps children in a block .bp3-button-text span, so this span is the row. */}
    <span className="flex min-w-0 items-start gap-2">
      <Tag
        aria-label={
          result.candidate
            ? `${nodeConfig?.text ?? result.nodeTypeLabel} candidate`
            : undefined
        }
        minimal
        style={getTagStyle({
          isCandidate: !!result.candidate,
          node: nodeConfig,
        })}
      >
        {nodeConfig
          ? getNodeBadgeText(nodeConfig)
          : formatBadgeText(result.nodeTypeLabel)}
      </Tag>
      <span className="flex min-w-0 flex-col">
        <span className="break-words text-sm leading-snug text-gray-900">
          {renderHighlightedText(stripTypePrefix(result.title), keywords)}
        </span>
        {subtitle && (
          <span className="truncate text-xs text-gray-500">{subtitle}</span>
        )}
      </span>
    </span>
  </Button>
);

const IMAGE_LOAD_TIMEOUT_MS = 1000;

// Unloaded images reserve no height, so scrolling before they load lands off target.
const waitForImages = (el: HTMLElement): Promise<void> => {
  const pending = Array.from(el.querySelectorAll("img")).filter(
    (img) => !img.complete,
  );
  if (!pending.length) return Promise.resolve();
  return Promise.race([
    Promise.all(
      pending.map(
        (img) =>
          new Promise((resolve) => {
            img.addEventListener("load", resolve, { once: true });
            img.addEventListener("error", resolve, { once: true });
          }),
      ),
    ).then(() => undefined),
    new Promise<void>((resolve) =>
      window.setTimeout(resolve, IMAGE_LOAD_TIMEOUT_MS),
    ),
  ]);
};

// Children of a collapsed block aren't in the DOM, and expanding would write
// :block/open to the user's graph.
const hasCollapsedAncestor = (uid: string): boolean =>
  window.roamAlphaAPI.data.fast.q(
    `[:find ?parent :in $ ?uid :where [?block :block/uid ?uid] [?block :block/parents ?parent] [?parent :block/open false]]`,
    uid,
  ).length > 0;

const CandidatePreview = ({
  uid,
  pageUid,
  scrollContainerRef,
}: {
  uid: string;
  pageUid: string;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}): React.ReactElement => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [renderedUid, setRenderedUid] = useState<string | null>(null);
  const showPage = useMemo(
    () => !!pageUid && !hasCollapsedAncestor(uid),
    [pageUid, uid],
  );
  const renderUid = showPage ? pageUid : uid;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    // A fresh mount node per render, so a pending unmount can't tear down the next one.
    const el = document.createElement("div");
    host.appendChild(el);
    setRenderedUid(null);
    void (async () => {
      const { components } = window.roamAlphaAPI.ui;
      await (showPage
        ? components.renderPage({ uid: renderUid, el, "hide-mentions?": true })
        : components.renderBlock({ uid: renderUid, el, "zoom-path?": true }));
      await waitForImages(el);
      if (!cancelled) setRenderedUid(renderUid);
    })();
    return () => {
      cancelled = true;
      void window.roamAlphaAPI.ui.components
        .unmountNode({ el })
        .then(() => el.remove());
    };
  }, [renderUid, showPage]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || renderedUid !== renderUid) return;
    let clearFlash = (): void => undefined;
    const frame = window.requestAnimationFrame(() => {
      clearFlash = revealBlockInPreview({ container, uid });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      clearFlash();
    };
  }, [renderedUid, renderUid, uid, scrollContainerRef]);

  return <div ref={hostRef} />;
};

const PreviewPane = ({ result }: { result: SearchResult | null }) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
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
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto border-t border-gray-200 px-5 py-3"
        onMouseDown={(event) => event.preventDefault()}
      >
        <div className="pointer-events-none">
          {result.candidate ? (
            <CandidatePreview
              uid={result.uid}
              pageUid={result.candidate.pageUid}
              scrollContainerRef={scrollContainerRef}
            />
          ) : isPage ? (
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
  const [searchIndex, setSearchIndex] = useState<SearchIndex | null>(null);
  const [sort, setSort] = useState<SortConfig>(DEFAULT_SORT_CONFIG);
  const [discourseNodes, setDiscourseNodes] = useState<DiscourseNode[]>([]);
  const [selectedNodeTypeIds, setSelectedNodeTypeIds] = useState<string[]>([]);
  const [isTypeFilterPopoverOpen, setIsTypeFilterPopoverOpen] = useState(false);
  const [showCandidates, setShowCandidates] = useState(false);
  const [isDisplayOptionsOpen, setIsDisplayOptionsOpen] = useState(false);
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [insertTarget, setInsertTarget] = useState<InsertTarget | null>(null);

  const nodeConfigByType = Object.fromEntries(
    discourseNodes.map((node) => [node.type, node]),
  );

  const { results, isSearching } = useAdvancedNodeSearchResults({
    debouncedSearchTerm,
    selectedNodeTypeIds,
    sort,
    isIndexLoading,
    indexError,
    searchIndex,
  });

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
      setShowCandidates(false);
      setIsDisplayOptionsOpen(false);
      setSearchIndex(null);
      setIndexError(false);
    }
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    setIsIndexLoading(true);
    setIndexError(false);
    setSearchIndex(null);

    const discourseNodes = getDiscourseNodes().filter(
      (node) => node.backedBy === "user",
    );
    setDiscourseNodes(discourseNodes);

    void buildSearchIndex({ discourseNodes, includeCandidates: showCandidates })
      .then(({ miniSearch, results: indexedResults }) => {
        if (cancelled) return;
        setSearchIndex({ miniSearch, allResults: indexedResults });
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
  }, [isOpen, showCandidates]);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearchTerm(searchTerm.trim()),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedSearchTerm, selectedNodeTypeIds, showCandidates, sort]);

  useEffect(() => {
    const panel = resultsPanelRef.current;
    if (!panel) return;

    const activeRow = panel.querySelector('[aria-selected="true"]');
    activeRow?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, activeResult?.uid, debouncedSearchTerm]);

  const onInsert = useCallback(async () => {
    if (!activeResult || activeResult.candidate || !insertTarget) return;

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
    : isIndexLoading || isSearching
      ? "indexing"
      : !debouncedSearchTerm && selectedNodeTypeIds.length === 0
        ? "initial"
        : !results.length
          ? "empty"
          : "results";

  const onOpenSearchSidebar = useCallback(async () => {
    if (contentState !== "results" || !results.length) return;

    try {
      await mountAdvancedSearchInSidebar({
        query: debouncedSearchTerm,
        results,
        selectedNodeTypeIds,
        sort,
        showCandidates,
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
    showCandidates,
    sort,
  ]);
  const handleSortChange = useCallback((nextSort: SortConfig): void => {
    setSort(nextSort);
  }, []);

  const onOpen = useCallback(async () => {
    if (!activeResult || contentState !== "results") return;

    const uid = activeResult.uid;
    if (getPageTitleByPageUid(uid)) {
      await window.roamAlphaAPI.ui.mainWindow.openPage({ page: { uid } });
    } else {
      await window.roamAlphaAPI.ui.mainWindow.openBlock({ block: { uid } });
    }
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

  const handleSearchKeyDown = useCallback(
    (event: React.KeyboardEvent): void => {
      if (event.key === "ArrowDown" && results.length) {
        event.preventDefault();
        setActiveIndex((index) =>
          Math.min(Math.max(index, 0) + 1, results.length - 1),
        );
        return;
      }
      if (event.key === "ArrowUp" && results.length) {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
        return;
      }
      if (
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
        return;
      }
      if (
        event.key === "Enter" &&
        (event.metaKey || event.ctrlKey) &&
        contentState === "results" &&
        activeResult &&
        !activeResult.candidate &&
        insertTarget
      ) {
        event.preventDefault();
        void onInsert();
        return;
      }
      if (event.key === "Escape") {
        if (isTypeFilterPopoverOpen) return;
        if (isDisplayOptionsOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsDisplayOptionsOpen(false);
          return;
        }
        event.preventDefault();
        onClose();
      }
    },
    [
      activeResult,
      contentState,
      isDisplayOptionsOpen,
      isTypeFilterPopoverOpen,
      insertTarget,
      onClose,
      onOpenSearchSidebar,
      onInsert,
      onOpen,
      onOpenInSidebar,
      results.length,
    ],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.defaultPrevented) return;
      handleSearchKeyDown(event);
    },
    [handleSearchKeyDown],
  );

  const showSplitView = contentState === "results";

  return (
    <Dialog
      autoFocus={false}
      canEscapeKeyClose
      canOutsideClickClose
      className="flex w-full max-w-4xl flex-col overflow-hidden bg-white p-0"
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
        <div className="flex w-full flex-none items-start gap-2 border-b border-gray-200 px-3 py-2">
          <div className="flex min-h-9 min-w-0 flex-1 items-center rounded border border-gray-300 bg-white px-2 py-1">
            <Icon
              className="mr-2 shrink-0 self-center text-gray-500"
              icon="search"
              size={16}
            />
            <NodeTypeChipsSearchInput
              inputRef={inputRef}
              nodeTypes={discourseNodes}
              onSearchKeyDown={handleSearchKeyDown}
              onSearchTermChange={setSearchTerm}
              onSelectedTypeIdsChange={setSelectedNodeTypeIds}
              searchTerm={searchTerm}
              selectedTypeIds={selectedNodeTypeIds}
            />
          </div>
          <DiscourseNodeTypeFilter
            layoutAnchorKey={selectedNodeTypeIds.length}
            nodeTypes={discourseNodes}
            onPopoverOpenChange={setIsTypeFilterPopoverOpen}
            onSelectedTypeIdsChange={setSelectedNodeTypeIds}
            selectedTypeIds={selectedNodeTypeIds}
          />
          <DiscourseNodeSortControl
            disabled={isIndexLoading || indexError}
            onSortChange={handleSortChange}
            sort={sort}
          />
          <DisplayOptionsMenu
            isOpen={isDisplayOptionsOpen}
            onOpenChange={setIsDisplayOptionsOpen}
            onShowCandidatesChange={setShowCandidates}
            showCandidates={showCandidates}
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
                {results.map((result, index) => (
                  <ResultRow
                    active={index === activeIndex}
                    key={result.uid}
                    keywords={keywords}
                    nodeConfig={nodeConfigByType[result.type]}
                    onClick={() => setActiveIndex(index)}
                    onMouseEnter={() => setActiveIndex(index)}
                    result={result}
                    subtitle={
                      result.candidate &&
                      getCandidateSubtitle({
                        candidate: result.candidate,
                        nodeConfigByType,
                      })
                    }
                  />
                ))}
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
                <span>No matches. Try another keyword or filter.</span>
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
          isActiveResultLinkable={!!activeResult && !activeResult.candidate}
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

export const renderAdvancedNodeSearchDialog = () =>
  renderOverlay({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Overlay: AdvancedNodeSearchDialog,
    props: {},
  });
