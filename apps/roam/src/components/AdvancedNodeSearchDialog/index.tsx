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
  InputGroup,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from "@blueprintjs/core";
import MiniSearch from "minisearch";
import posthog from "posthog-js";
import { render as renderToast } from "roamjs-components/components/Toast";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import {
  getPageLinkTitle,
  insertPageLinkAtCursor,
  snapshotInsertTarget,
  type InsertTarget,
} from "~/utils/advancedSearchFooterUtils";
import getDiscourseNodes, {
  type DiscourseNode,
} from "~/utils/getDiscourseNodes";
import { getNodeTagStyles } from "~/utils/getDiscourseNodeColors";
import {
  DEBOUNCE_MS,
  type SearchResult,
  buildSearchIndex,
  formatMetadataDate,
  searchIndexedNodes,
  splitWithHighlights,
  stripTypePrefix,
} from "./utils";
import { RenderRoamBlock, RenderRoamPage } from "~/utils/roamReactComponents";
import { AdvancedSearchFooter } from "./AdvancedSearchFooter";

type Props = Record<string, unknown>;

const getNodeBadgeText = (node: DiscourseNode): string =>
  (node.tag?.trim() || node.text).slice(0, 3).toUpperCase();

const getTagStyle = (node: DiscourseNode | undefined): React.CSSProperties => {
  const color = node?.canvasSettings?.color;
  if (!color) return { flexShrink: 0 };
  return { ...getNodeTagStyles(color), flexShrink: 0 };
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
}: {
  active: boolean;
  keywords: string[];
  nodeConfig: DiscourseNode | undefined;
  onClick: () => void;
  onMouseEnter: () => void;
  result: SearchResult;
}) => (
  <Button
    alignText="left"
    aria-selected={active}
    className="flex-none !items-start gap-2 !px-3 !py-2"
    fill
    minimal
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    role="option"
    style={{
      background: active ? "rgba(95, 87, 192, 0.08)" : undefined,
      boxShadow: active ? "inset 3px 0 0 #5f57c0" : undefined,
    }}
  >
    <Tag minimal style={getTagStyle(nodeConfig)}>
      {nodeConfig ? getNodeBadgeText(nodeConfig) : result.nodeTypeLabel}
    </Tag>
    <span className="min-w-0 break-words text-sm leading-snug text-gray-900">
      {renderHighlightedText(stripTypePrefix(result.title), keywords)}
    </span>
  </Button>
);

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
  const miniSearchRef = useRef<MiniSearch<
    SearchResult & { id: string }
  > | null>(null);
  const allResultsRef = useRef<SearchResult[]>([]);
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [insertTarget, setInsertTarget] = useState<InsertTarget | null>(null);

  const nodeConfigByType = useMemo(() => {
    const discourseNodes = getDiscourseNodes().filter(
      (node) => node.backedBy === "user",
    );
    return Object.fromEntries(
      discourseNodes.map((node) => [node.type, node]),
    ) as Record<string, DiscourseNode>;
  }, []);

  const results =
    isOpen &&
    !isIndexLoading &&
    !indexError &&
    debouncedSearchTerm &&
    miniSearchRef.current
      ? searchIndexedNodes({
          miniSearch: miniSearchRef.current,
          allResults: allResultsRef.current,
          searchTerm: debouncedSearchTerm,
        })
      : [];

  const activeResult = results[activeIndex] ?? null;

  const keywords = useMemo(
    () => debouncedSearchTerm.split(/\s+/).filter(Boolean),
    [debouncedSearchTerm],
  );

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
  }, [debouncedSearchTerm]);

  useEffect(() => {
    const panel = resultsPanelRef.current;
    if (!panel) return;

    const activeRow = panel.querySelector('[aria-selected="true"]');
    activeRow?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, activeResult?.uid, debouncedSearchTerm]);

  const onInsert = useCallback(async () => {
    if (!activeResult || !insertTarget) return;

    const pageTitle = getPageLinkTitle({
      resultUid: activeResult.uid,
      resultTitle: activeResult.title,
    });
    const didInsert = await insertPageLinkAtCursor({
      pageTitle,
      snapshot: insertTarget,
    });
    if (!didInsert) return;

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
      onInsert,
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
          <Button icon="cross" minimal onClick={onClose} title="Close search" />
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
