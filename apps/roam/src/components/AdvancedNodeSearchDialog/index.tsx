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
    className={`flex w-full cursor-pointer gap-2.5 border-0 px-4 py-3 text-left ${
      active ? "bg-blue-50" : "bg-transparent"
    }`}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    role="option"
  >
    <Tag minimal style={getTagStyle(nodeConfig)}>
      {nodeConfig ? getNodeBadgeText(nodeConfig) : result.nodeTypeLabel}
    </Tag>
    <span className="min-w-0">
      <span className="text-sm leading-snug text-gray-900">
        {renderHighlightedText(stripTypePrefix(result.title), keywords)}
      </span>
      {result.excerpt && (
        <span className="mt-1 block text-xs leading-snug text-gray-500">
          {result.excerpt}
        </span>
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
      <div className="flex h-full items-center justify-center p-6">
        <NonIdealState
          icon="search"
          title="Search DG nodes"
          description="Type a keyword to preview matching discourse graph nodes."
        />
      </div>
    );
  }

  if (isLoading || !content) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Spinner size={SpinnerSize.SMALL} />
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-8">
      <Tag minimal style={getTagStyle(nodeConfig)}>
        {nodeConfig ? nodeConfig.text : result.nodeTypeLabel}
      </Tag>
      <h2 className="my-3.5 text-2xl leading-tight text-gray-900">
        {renderHighlightedText(stripTypePrefix(content.title), keywords)}
      </h2>
      <div className="text-xs tracking-wide text-gray-500">
        Last modified: {formatMetadataDate(result.lastModified)} · Created:{" "}
        {formatMetadataDate(result.createdAt)} · Author: {result.authorName}
      </div>
      <div className="mt-6 border-t border-gray-200 pt-4 text-[15px] leading-relaxed text-gray-900">
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
    inputRef.current?.focus();
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

  return (
    <Dialog
      autoFocus={false}
      canEscapeKeyClose
      canOutsideClickClose
      className="roamjs-canvas-dialog w-[min(980px,calc(100vw-64px))] max-w-[980px]"
      isOpen={isOpen}
      onClose={onClose}
      title="DG node search"
    >
      <div
        className="pointer-events-auto"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
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
        <div className="grid h-[560px] min-h-[420px] grid-cols-[minmax(280px,38%)_minmax(0,1fr)]">
          <div
            aria-label="Search results"
            className="overflow-y-auto border-r border-gray-200"
            ref={resultsPanelRef}
            role="listbox"
          >
            {contentState === "error" && (
              <div className="flex h-full items-center justify-center p-6">
                <NonIdealState
                  icon="error"
                  title="Search unavailable"
                  description="Reload the extension and try again."
                />
              </div>
            )}
            {contentState === "indexing" && (
              <div className="flex h-full items-center justify-center p-6">
                <Spinner size={SpinnerSize.SMALL} />
              </div>
            )}
            {contentState === "initial" && (
              <div className="flex h-full items-center justify-center p-6">
                <NonIdealState title="Search DG nodes" />
              </div>
            )}
            {contentState === "empty" && (
              <div className="flex h-full items-center justify-center p-6">
                <NonIdealState
                  icon="search"
                  title="No results"
                  description="Try another keyword."
                />
              </div>
            )}
            {contentState === "results" &&
              results.map((result, index) => (
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
