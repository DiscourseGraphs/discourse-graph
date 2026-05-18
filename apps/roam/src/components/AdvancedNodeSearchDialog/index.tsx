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

const SEARCH_DIALOG_STYLES = `
  .roamjs-canvas-dialog.dg-advanced-node-search > .bp3-dialog-body {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    margin: 0;
    min-height: 0;
    overflow: hidden;
    padding: 0;
  }

  .roamjs-canvas-dialog.dg-advanced-node-search mark {
    background: rgba(255, 200, 60, 0.45);
    border-radius: 2px;
    color: inherit;
    padding: 0 1px;
  }
`;

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
    className="w-full cursor-pointer border-0 bg-transparent p-0 text-left"
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    role="option"
    style={{
      alignItems: "flex-start",
      background: active ? "rgba(95, 87, 192, 0.08)" : undefined,
      boxShadow: active ? "inset 3px 0 0 #5f57c0" : undefined,
      display: "flex",
      flex: "0 0 auto",
      gap: 8,
      padding: "8px 12px",
      width: "100%",
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
      <div
        className="overflow-hidden"
        style={{
          alignItems: "center",
          display: "flex",
          flex: 1,
          justifyContent: "center",
          minHeight: 0,
        }}
      >
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
    <div
      className="overflow-y-auto px-5 py-4"
      style={{ flex: 1, minHeight: 0 }}
    >
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
      className="roamjs-canvas-dialog dg-advanced-node-search"
      enforceFocus={false}
      isOpen={isOpen}
      onClose={onClose}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "72vh",
        maxWidth: "980px",
        overflow: "hidden",
        padding: 0,
        width: "min(980px, calc(100vw - 64px))",
      }}
    >
      <style>{SEARCH_DIALOG_STYLES}</style>
      <div
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
        style={{
          display: "flex",
          flex: 1,
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
          pointerEvents: "all",
        }}
      >
        <div
          className="border-b border-gray-200"
          style={{
            alignItems: "center",
            display: "flex",
            flex: "0 0 auto",
            gap: 8,
            padding: "8px 12px",
          }}
        >
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
        <div
          style={{
            display: "flex",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
            width: "100%",
          }}
        >
          {showSplitView ? (
            <>
              <div
                aria-label="Search results"
                className="overflow-y-auto py-1"
                ref={resultsPanelRef}
                role="listbox"
                style={{
                  borderRight: "1px solid rgba(31, 31, 31, 0.12)",
                  flex: "0 0 33.333%",
                  maxWidth: "33.333%",
                  minHeight: 0,
                  width: "33.333%",
                }}
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
              <div
                style={{
                  display: "flex",
                  flex: "1 1 0",
                  flexDirection: "column",
                  minHeight: 0,
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
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
            <div
              className="w-full px-4 py-8 text-center text-sm text-gray-500"
              style={{
                alignItems: "center",
                display: "flex",
                flex: 1,
                justifyContent: "center",
                minHeight: 0,
              }}
            >
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
