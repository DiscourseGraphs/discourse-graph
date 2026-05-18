import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  NonIdealState,
  Spinner,
  SpinnerSize,
  Tag,
} from "@blueprintjs/core";
import MiniSearch from "minisearch";
import { render as renderToast } from "roamjs-components/components/Toast";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getDiscourseNodes, {
  type DiscourseNode,
} from "~/utils/getDiscourseNodes";
import { getNodeTagStyles } from "~/utils/getDiscourseNodeColors";
import {
  DEBOUNCE_MS,
  type NodeContent,
  type SearchResult,
  buildSearchIndex,
  formatMetadataDate,
  pullNodeContent,
  searchIndexedNodes,
  splitWithHighlights,
  stripTypePrefix,
} from "./utils";

type Props = Record<string, unknown>;

const focusSearchInput = (input: HTMLInputElement | null): void => {
  input?.focus();
};

const getNodeBadgeText = (node: DiscourseNode): string =>
  (node.tag?.trim() || node.text).slice(0, 3).toUpperCase();

const getTagStyle = (node: DiscourseNode | undefined): React.CSSProperties => {
  const color = node?.canvasSettings?.color;
  if (!color) return { flexShrink: 0 };
  return { ...getNodeTagStyles(color), flexShrink: 0 };
};

const getCachedNodeContent = (
  cache: Map<string, NodeContent>,
  uid: string,
  title: string,
): NodeContent | null => {
  const cached = cache.get(uid);
  if (cached) return cached;

  const content = pullNodeContent(uid, title);
  if (content) cache.set(uid, content);
  return content;
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
  <button
    type="button"
    aria-selected={active}
    className="flex w-full flex-none cursor-pointer items-start gap-2 border-0 bg-transparent p-0 px-3 py-2 text-left"
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
  </button>
);

const PreviewPane = ({
  content,
  keywords,
  nodeConfig,
  result,
}: {
  content: NodeContent | null;
  keywords: string[];
  nodeConfig: DiscourseNode | undefined;
  result: SearchResult | null;
}) => {
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

  const previewTitle = content?.title ?? result.title;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
      <Tag minimal style={getTagStyle(nodeConfig)}>
        {nodeConfig ? nodeConfig.text : result.nodeTypeLabel}
      </Tag>
      <h2 className="my-2 text-xl leading-tight text-gray-900">
        {renderHighlightedText(stripTypePrefix(previewTitle), keywords)}
      </h2>
      <div className="text-xs text-gray-500">
        Last modified: {formatMetadataDate(result.lastModified)} · Created:{" "}
        {formatMetadataDate(result.createdAt)} · Author: {result.authorName}
      </div>
      <div className="mt-4 border-t border-gray-200 pt-3 text-sm leading-relaxed text-gray-900">
        {content?.lines.length ? (
          content.lines.map((line, index) => <p key={index}>{line}</p>)
        ) : (
          <span className={Classes.TEXT_MUTED}>No content</span>
        )}
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
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isIndexLoading, setIsIndexLoading] = useState(false);
  const [indexError, setIndexError] = useState(false);
  const [previewContent, setPreviewContent] = useState<NodeContent | null>(
    null,
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [nodeConfigByType, setNodeConfigByType] = useState<
    Record<string, DiscourseNode>
  >({});
  const miniSearchRef = useRef<MiniSearch<
    SearchResult & { id: string }
  > | null>(null);
  const allResultsRef = useRef<SearchResult[]>([]);
  const visibleResultsRef = useRef<SearchResult[]>([]);
  const contentCacheRef = useRef<Map<string, NodeContent>>(new Map());
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const activeResult = results[activeIndex] ?? null;

  const keywords = useMemo(
    () => debouncedSearchTerm.split(/\s+/).filter(Boolean),
    [debouncedSearchTerm],
  );

  useEffect(() => {
    if (!isOpen) return;

    const focusInput = () => focusSearchInput(inputRef.current);

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
      setResults([]);
      setActiveIndex(0);
      setPreviewContent(null);
      setIndexError(false);
      miniSearchRef.current = null;
      allResultsRef.current = [];
      visibleResultsRef.current = [];
      contentCacheRef.current.clear();
      return;
    }

    let cancelled = false;
    setIsIndexLoading(true);
    setIndexError(false);

    const discourseNodes = getDiscourseNodes().filter(
      (node) => node.backedBy === "user",
    );
    setNodeConfigByType(
      Object.fromEntries(discourseNodes.map((node) => [node.type, node])),
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
    if (!isOpen || isIndexLoading || indexError) return;

    const query = debouncedSearchTerm;
    if (!query || !miniSearchRef.current) {
      visibleResultsRef.current = [];
      setResults([]);
      setActiveIndex(0);
      setPreviewContent(null);
      return;
    }

    const matchedResults = searchIndexedNodes({
      miniSearch: miniSearchRef.current,
      allResults: allResultsRef.current,
      searchTerm: query,
    });
    visibleResultsRef.current = matchedResults;

    if (!matchedResults.length) {
      setResults([]);
      setActiveIndex(0);
      setPreviewContent(null);
      return;
    }

    const firstResult = matchedResults[0];
    setResults(matchedResults);
    setActiveIndex(0);
    setPreviewContent(
      getCachedNodeContent(
        contentCacheRef.current,
        firstResult.uid,
        firstResult.title,
      ),
    );
  }, [debouncedSearchTerm, indexError, isIndexLoading, isOpen]);

  useEffect(() => {
    if (!activeResult) {
      setPreviewContent(null);
      return;
    }

    setPreviewContent(
      getCachedNodeContent(
        contentCacheRef.current,
        activeResult.uid,
        activeResult.title,
      ),
    );
  }, [activeResult?.uid, activeResult?.title]);

  useEffect(() => {
    const panel = resultsPanelRef.current;
    if (!panel) return;

    const activeRow = panel.querySelector('[aria-selected="true"]');
    activeRow?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowDown" && results.length) {
        event.preventDefault();
        setActiveIndex((index) => Math.min(index + 1, results.length - 1));
      } else if (event.key === "ArrowUp" && results.length) {
        event.preventDefault();
        setActiveIndex((index) => Math.max(index - 1, 0));
      } else if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    },
    [onClose, results.length],
  );

  const contentState = useMemo(() => {
    if (indexError) return "error";
    if (isIndexLoading) return "indexing";
    if (!debouncedSearchTerm) return "initial";
    if (!results.length) return "empty";
    return "results";
  }, [debouncedSearchTerm, indexError, isIndexLoading, results.length]);

  const showSplitView = contentState === "results";

  return (
    <Dialog
      autoFocus={false}
      canEscapeKeyClose
      canOutsideClickClose
      className="flex-col overflow-hidden bg-white p-0"
      enforceFocus={false}
      isOpen={isOpen}
      onClose={onClose}
      style={{
        height: "72vh",
        maxWidth: "980px",
        width: "min(980px, calc(100vw - 64px))",
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
                <PreviewPane
                  content={previewContent}
                  keywords={keywords}
                  nodeConfig={
                    activeResult
                      ? nodeConfigByType[activeResult.type]
                      : undefined
                  }
                  result={activeResult}
                />
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
