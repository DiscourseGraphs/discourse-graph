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

const dialogStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  height: "72vh",
  maxWidth: "980px",
  overflow: "hidden",
  padding: 0,
  width: "min(980px, calc(100vw - 64px))",
};

const modalStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
  margin: 0,
  minHeight: 0,
  overflow: "hidden",
  padding: 0,
  pointerEvents: "all",
};

const searchHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  borderBottom: "1px solid rgba(31, 31, 31, 0.12)",
  display: "flex",
  flexShrink: 0,
  gap: "8px",
  padding: "12px 16px",
};

const bodyStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};

const resultsPanelStyle: React.CSSProperties = {
  borderRight: "1px solid rgba(31, 31, 31, 0.12)",
  flexShrink: 0,
  minHeight: 0,
  overflowY: "auto",
  width: "38%",
};

const previewColumnStyle: React.CSSProperties = {
  display: "flex",
  flex: 1,
  flexDirection: "column",
  minHeight: 0,
  overflow: "hidden",
};

const previewPanelStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
  padding: "32px",
};

const emptyPanelStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  height: "100%",
  justifyContent: "center",
  padding: "24px",
};

const messagePanelStyle: React.CSSProperties = {
  alignItems: "center",
  color: "rgba(31, 31, 31, 0.5)",
  display: "flex",
  flex: 1,
  fontSize: "14px",
  justifyContent: "center",
  minHeight: 0,
  padding: "48px 16px",
  textAlign: "center",
  width: "100%",
};

const focusSearchInput = (input: HTMLInputElement | null): void => {
  input?.focus();
};

const resultTitleStyle: React.CSSProperties = {
  color: "#1f1f1f",
  fontSize: "14px",
  lineHeight: 1.4,
  wordBreak: "break-word",
};

const resultExcerptStyle: React.CSSProperties = {
  color: "rgba(31, 31, 31, 0.55)",
  display: "block",
  fontSize: "12px",
  lineHeight: 1.35,
  marginTop: "4px",
};

const previewTitleStyle: React.CSSProperties = {
  color: "#1f1f1f",
  fontSize: "22px",
  lineHeight: 1.25,
  margin: "14px 0",
};

const previewMetaStyle: React.CSSProperties = {
  color: "rgba(31, 31, 31, 0.55)",
  fontSize: "12px",
  letterSpacing: "0.02em",
};

const previewBodyStyle: React.CSSProperties = {
  borderTop: "1px solid rgba(31, 31, 31, 0.12)",
  color: "#1f1f1f",
  fontSize: "15px",
  lineHeight: 1.55,
  marginTop: "24px",
  paddingTop: "16px",
};

const getResultRowStyle = (active: boolean): React.CSSProperties => ({
  alignItems: "flex-start",
  background: active ? "rgba(95, 87, 192, 0.08)" : "transparent",
  border: 0,
  boxShadow: active ? "inset 3px 0 0 #5f57c0" : undefined,
  cursor: "pointer",
  display: "flex",
  gap: "10px",
  padding: "12px 16px",
  textAlign: "left",
  width: "100%",
});

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
  <button
    type="button"
    aria-selected={active}
    className="dg-advanced-node-search-result"
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    role="option"
    style={getResultRowStyle(active)}
  >
    <Tag minimal style={getTagStyle(nodeConfig)}>
      {nodeConfig ? getNodeBadgeText(nodeConfig) : result.nodeTypeLabel}
    </Tag>
    <span style={{ minWidth: 0 }}>
      <span style={resultTitleStyle}>
        {renderHighlightedText(stripTypePrefix(result.title), keywords)}
      </span>
      {result.excerpt && (
        <span style={resultExcerptStyle}>{result.excerpt}</span>
      )}
    </span>
  </button>
);

const PreviewPane = ({
  content,
  isLoading,
  keywords,
  nodeConfig,
  result,
}: {
  content: NodeContent | null;
  isLoading: boolean;
  keywords: string[];
  nodeConfig: DiscourseNode | undefined;
  result: SearchResult | null;
}) => {
  if (!result) {
    return (
      <div style={previewColumnStyle}>
        <div style={emptyPanelStyle}>
          <NonIdealState
            icon="search"
            title="Search DG nodes"
            description="Type a keyword to preview matching discourse graph nodes."
          />
        </div>
      </div>
    );
  }

  if (isLoading || !content) {
    return (
      <div style={previewColumnStyle}>
        <div style={emptyPanelStyle}>
          <Spinner size={SpinnerSize.SMALL} />
        </div>
      </div>
    );
  }

  return (
    <div style={previewPanelStyle}>
      <Tag minimal style={getTagStyle(nodeConfig)}>
        {nodeConfig ? nodeConfig.text : result.nodeTypeLabel}
      </Tag>
      <h2 style={previewTitleStyle}>
        {renderHighlightedText(stripTypePrefix(content.title), keywords)}
      </h2>
      <div style={previewMetaStyle}>
        Last modified: {formatMetadataDate(result.lastModified)} · Created:{" "}
        {formatMetadataDate(result.createdAt)} · Author: {result.authorName}
      </div>
      <div style={previewBodyStyle}>
        {content.lines.length ? (
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
  const [isEnrichingResults, setIsEnrichingResults] = useState(false);
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
  const activeContent = activeResult
    ? (contentCacheRef.current.get(activeResult.uid) ?? null)
    : null;

  const keywords = useMemo(
    () => debouncedSearchTerm.split(/\s+/).filter(Boolean),
    [debouncedSearchTerm],
  );
  const resultUids = useMemo(
    () => results.map((result) => result.uid).join(","),
    [results],
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
      return;
    }

    const matchedResults = searchIndexedNodes({
      miniSearch: miniSearchRef.current,
      allResults: allResultsRef.current,
      searchTerm: query,
    });
    visibleResultsRef.current = matchedResults;
    setResults(matchedResults);
    setActiveIndex(0);
  }, [debouncedSearchTerm, indexError, isIndexLoading, isOpen]);

  useEffect(() => {
    if (!resultUids) return;

    let cancelled = false;
    const visibleResults = visibleResultsRef.current;

    const missingResults = visibleResults.filter(
      (result) => !contentCacheRef.current.has(result.uid),
    );

    const applyExcerpts = () => {
      setResults((currentResults) =>
        currentResults.map((result) => ({
          ...result,
          excerpt: contentCacheRef.current.get(result.uid)?.excerpt ?? "",
        })),
      );
    };

    if (!missingResults.length) {
      const needsExcerptUpdate = visibleResults.some(
        (result) =>
          !result.excerpt &&
          (contentCacheRef.current.get(result.uid)?.excerpt ?? ""),
      );
      if (needsExcerptUpdate) applyExcerpts();
      return;
    }

    setIsEnrichingResults(true);

    void Promise.all(
      missingResults.map(async (result) => {
        const content = pullNodeContent(result.uid, result.title);
        if (content) contentCacheRef.current.set(result.uid, content);
      }),
    )
      .then(() => {
        if (cancelled) return;
        applyExcerpts();
      })
      .finally(() => {
        if (!cancelled) setIsEnrichingResults(false);
      });

    return () => {
      cancelled = true;
    };
  }, [resultUids]);

  useEffect(() => {
    setActiveIndex((currentIndex) =>
      results.length ? Math.min(currentIndex, results.length - 1) : 0,
    );
  }, [results.length]);

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
    if (!results.length && !isEnrichingResults) return "empty";
    return "results";
  }, [
    debouncedSearchTerm,
    indexError,
    isEnrichingResults,
    isIndexLoading,
    results.length,
  ]);

  const showSplitView = contentState === "results";

  return (
    <Dialog
      autoFocus={false}
      canEscapeKeyClose
      canOutsideClickClose
      className="roamjs-canvas-dialog"
      enforceFocus={false}
      isOpen={isOpen}
      onClose={onClose}
      style={dialogStyle}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
        style={modalStyle}
      >
        <div style={searchHeaderStyle}>
          <InputGroup
            fill
            inputRef={(element) => {
              inputRef.current = element;
              if (isOpen) focusSearchInput(element);
            }}
            leftIcon="search"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search discourse nodes..."
            value={searchTerm}
          />
          <Button icon="cross" minimal onClick={onClose} title="Close search" />
        </div>
        <div style={bodyStyle}>
          {showSplitView ? (
            <>
              <div
                aria-label="Search results"
                ref={resultsPanelRef}
                role="listbox"
                style={resultsPanelStyle}
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
              <PreviewPane
                content={activeContent}
                isLoading={
                  isEnrichingResults &&
                  !!activeResult &&
                  !contentCacheRef.current.has(activeResult.uid)
                }
                keywords={keywords}
                nodeConfig={
                  activeResult ? nodeConfigByType[activeResult.type] : undefined
                }
                result={activeResult}
              />
            </>
          ) : (
            <div style={messagePanelStyle}>
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
