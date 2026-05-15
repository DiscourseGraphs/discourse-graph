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
import { colord } from "colord";
import MiniSearch from "minisearch";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import getDiscourseNodes, {
  type DiscourseNode,
} from "~/utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";

const DEBOUNCE_MS = 250;
const MAX_RESULTS = 50;
const MIN_SEARCH_SCORE = 0.1;
const EXCERPT_LENGTH = 200;
const PREVIEW_DEBOUNCE_MS = 80;

type Props = Record<string, unknown>;

type SearchResult = {
  uid: string;
  title: string;
  type: string;
  nodeTypeLabel: string;
  excerpt: string;
  createdAt: string;
  lastModified: string;
  authorName: string;
};

type MiniSearchDocument = SearchResult & {
  id: string;
};

type PulledNode = {
  ":block/string"?: string;
  ":block/uid"?: string;
  ":node/title"?: string;
  ":create/time"?: string | number;
  ":edit/time"?: string | number;
  ":create/user"?: PulledUser;
  ":edit/user"?: PulledUser;
  ":block/children"?: PulledBlock[];
};

type PulledUser = {
  ":user/display-name"?: string;
  ":user/email"?: string;
};

type PulledBlock = {
  ":block/string"?: string;
  ":block/order"?: number;
  ":block/children"?: PulledBlock[];
};

type PreviewContent = {
  title: string;
  lines: string[];
};

const dialogStyle: React.CSSProperties = {
  width: "min(980px, calc(100vw - 64px))",
  maxWidth: "980px",
};

const searchHeaderStyle: React.CSSProperties = {
  alignItems: "center",
  borderBottom: "1px solid var(--bc-border-color, #d8e1e8)",
  display: "flex",
  gap: "8px",
  padding: "12px 16px",
};

const bodyStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 38%) minmax(0, 1fr)",
  height: "560px",
  minHeight: "420px",
};

const resultsPanelStyle: React.CSSProperties = {
  borderRight: "1px solid var(--bc-border-color, #d8e1e8)",
  overflowY: "auto",
};

const previewPanelStyle: React.CSSProperties = {
  overflowY: "auto",
  padding: "32px",
};

const resultRowBaseStyle: React.CSSProperties = {
  alignItems: "flex-start",
  background: "transparent",
  border: 0,
  cursor: "pointer",
  display: "flex",
  gap: "10px",
  padding: "12px 16px",
  textAlign: "left",
  width: "100%",
};

const resultRowActiveStyle: React.CSSProperties = {
  background: "rgba(19, 124, 189, 0.08)",
};

const resultTitleStyle: React.CSSProperties = {
  color: "var(--bc-text-color, #182026)",
  fontSize: "14px",
  lineHeight: 1.35,
};

const resultExcerptStyle: React.CSSProperties = {
  color: "var(--bc-text-color-muted, #5c7080)",
  display: "block",
  fontSize: "12px",
  lineHeight: 1.35,
  marginTop: "4px",
};

const previewTitleStyle: React.CSSProperties = {
  color: "var(--bc-text-color, #182026)",
  fontSize: "22px",
  lineHeight: 1.25,
  margin: "14px 0 14px",
};

const previewBodyStyle: React.CSSProperties = {
  borderTop: "1px solid var(--bc-border-color, #d8e1e8)",
  color: "var(--bc-text-color, #182026)",
  fontSize: "15px",
  lineHeight: 1.55,
  marginTop: "24px",
  paddingTop: "16px",
};

const previewMetaStyle: React.CSSProperties = {
  color: "var(--bc-text-color-muted, #5c7080)",
  fontSize: "12px",
  letterSpacing: "0.02em",
};

const emptyPanelStyle: React.CSSProperties = {
  alignItems: "center",
  display: "flex",
  height: "100%",
  justifyContent: "center",
  padding: "24px",
};

const stripTypePrefix = (title: string): string => {
  const match = title.match(/^\[\[.*?\]\]\s*-\s*(.*)/s);
  return match ? match[1] : title;
};

const getNodeBadgeText = (node: DiscourseNode): string =>
  (node.tag?.trim() || node.text).slice(0, 3).toUpperCase();

const getNodeTagStyle = (
  node: DiscourseNode | undefined,
): React.CSSProperties => {
  const rawColor = node?.canvasSettings?.color;
  if (!rawColor) return { flexShrink: 0 };

  const formattedColor = rawColor.startsWith("#") ? rawColor : `#${rawColor}`;
  const color = colord(formattedColor);
  if (!color.isValid()) return { flexShrink: 0 };

  return {
    backgroundColor: color.alpha(0.14).toRgbString(),
    border: `1px solid ${color.alpha(0.35).toRgbString()}`,
    color: color.isDark()
      ? color.lighten(0.12).toHex()
      : color.darken(0.28).toHex(),
    flexShrink: 0,
    fontWeight: 500,
  };
};

const truncateText = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trim()}...`;
};

const splitWithHighlights = (
  text: string,
  keywords: string[],
): { text: string; isMatch: boolean }[] => {
  if (!keywords.length) return [{ text, isMatch: false }];

  const escapedKeywords = keywords.map((keyword) =>
    keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
  );
  const regex = new RegExp(`(${escapedKeywords.join("|")})`, "gi");
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());

  return text
    .split(regex)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      isMatch: loweredKeywords.includes(part.toLowerCase()),
    }));
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

const formatMetadataDate = (value: string): string => {
  if (!value) return "Unknown";
  const numericValue = Number(value);
  const date = Number.isFinite(numericValue)
    ? new Date(numericValue)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const getAuthorName = (pulled: PulledNode): string =>
  pulled[":edit/user"]?.[":user/display-name"] ||
  pulled[":create/user"]?.[":user/display-name"] ||
  pulled[":edit/user"]?.[":user/email"] ||
  pulled[":create/user"]?.[":user/email"] ||
  "Unknown";

const getPulledTextLines = (pulled: PulledNode | null): string[] => {
  if (!pulled) return [];

  const ownText = pulled[":block/string"];
  const childLines = (pulled[":block/children"] ?? [])
    .sort((a, b) => (a[":block/order"] ?? 0) - (b[":block/order"] ?? 0))
    .map((child) => child[":block/string"] ?? "")
    .filter(Boolean);

  return [ownText, ...childLines].filter(
    (line): line is string =>
      typeof line === "string" && line.trim().length > 0,
  );
};

const pullNode = (uid: string): PulledNode | null => {
  try {
    return window.roamAlphaAPI.pull(
      "[:block/string :node/title :create/time :edit/time {:create/user [:user/display-name :user/email]} {:edit/user [:user/display-name :user/email]} {:block/children [:block/string :block/order]}]",
      [":block/uid", uid],
    ) as PulledNode | null;
  } catch (error) {
    console.error("Error pulling node content:", error);
    return null;
  }
};

const getExcerpt = (uid: string): string => {
  const pulled = pullNode(uid);
  return truncateText(getPulledTextLines(pulled).join(" "), EXCERPT_LENGTH);
};

const getPreviewContent = (
  uid: string,
  fallbackTitle: string,
): PreviewContent => {
  const pulled = pullNode(uid);
  return {
    title:
      pulled?.[":node/title"] || pulled?.[":block/string"] || fallbackTitle,
    lines: getPulledTextLines(pulled),
  };
};

const queryNodesForType = async (
  node: DiscourseNode,
): Promise<SearchResult[]> => {
  if (!node.format) return [];

  try {
    const regex = getDiscourseNodeFormatExpression(node.format);
    const regexPattern = regex.source
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const query = `[
      :find
        (pull ?node [:block/string :node/title :block/uid :create/time :edit/time {:create/user [:user/display-name :user/email]} {:edit/user [:user/display-name :user/email]}])
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
        [(re-find ?title-regex ?node-title)]
    ]`;

    const queryResults = (await window.roamAlphaAPI.data.async.fast.q(
      query,
    )) as [PulledNode][];

    return queryResults
      .map(([result]) => {
        const uid = result[":block/uid"];
        const title = result[":node/title"] || result[":block/string"] || "";
        if (!uid || !title) return null;

        return {
          uid,
          title,
          type: node.type,
          nodeTypeLabel: node.text,
          excerpt: getExcerpt(uid),
          createdAt: String(result[":create/time"] || ""),
          lastModified: String(
            result[":edit/time"] || result[":create/time"] || "",
          ),
          authorName: getAuthorName(result),
        };
      })
      .filter((result): result is SearchResult => !!result);
  } catch (error) {
    console.error(`Error querying for node type ${node.type}:`, error);
    return [];
  }
};

const searchNodes = async (searchTerm: string): Promise<SearchResult[]> => {
  const discourseNodes = getDiscourseNodes().filter(
    (node) => node.backedBy === "user",
  );
  const resultsByType = await Promise.all(
    discourseNodes.map(queryNodesForType),
  );
  const results = resultsByType.flat();

  const miniSearch = new MiniSearch<MiniSearchDocument>({
    fields: ["title", "excerpt", "nodeTypeLabel"],
    storeFields: ["uid", "title", "type", "nodeTypeLabel", "excerpt"],
    idField: "id",
  });

  miniSearch.addAll(results.map((result) => ({ ...result, id: result.uid })));

  const resultsByUid = new Map(results.map((result) => [result.uid, result]));

  return miniSearch
    .search(searchTerm, {
      fields: ["title", "excerpt", "nodeTypeLabel"],
      fuzzy: 0.2,
      prefix: true,
      combineWith: "AND",
    })
    .filter((result) => result.score > MIN_SEARCH_SCORE)
    .slice(0, MAX_RESULTS)
    .map((result) => resultsByUid.get(String(result.id)))
    .filter((result): result is SearchResult => !!result);
};

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
    style={{
      ...resultRowBaseStyle,
      ...(active ? resultRowActiveStyle : {}),
    }}
  >
    <Tag minimal style={getNodeTagStyle(nodeConfig)}>
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
  isLoading,
  keywords,
  nodeConfig,
  preview,
  result,
}: {
  isLoading: boolean;
  keywords: string[];
  nodeConfig: DiscourseNode | undefined;
  preview: PreviewContent | null;
  result: SearchResult | null;
}) => {
  if (!result) {
    return (
      <div style={emptyPanelStyle}>
        <NonIdealState
          icon="search"
          title="Search DG nodes"
          description="Type a keyword to preview matching discourse graph nodes."
        />
      </div>
    );
  }

  if (isLoading || !preview) {
    return (
      <div style={emptyPanelStyle}>
        <Spinner size={SpinnerSize.SMALL} />
      </div>
    );
  }

  return (
    <div style={previewPanelStyle}>
      <Tag minimal style={getNodeTagStyle(nodeConfig)}>
        {nodeConfig ? nodeConfig.text : result.nodeTypeLabel}
      </Tag>
      <h2 style={previewTitleStyle}>
        {renderHighlightedText(stripTypePrefix(preview.title), keywords)}
      </h2>
      <div style={previewMetaStyle}>
        Last modified: {formatMetadataDate(result.lastModified)} · Created:{" "}
        {formatMetadataDate(result.createdAt)} · Author: {result.authorName}
      </div>
      <div style={previewBodyStyle}>
        {preview.lines.length ? (
          preview.lines.map((line, index) => <p key={index}>{line}</p>)
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
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [preview, setPreview] = useState<PreviewContent | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const previewCacheRef = useRef<Map<string, PreviewContent>>(new Map());
  const resultsPanelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const nodeConfigByType = useMemo(
    () =>
      Object.fromEntries(
        getDiscourseNodes()
          .filter((node) => node.backedBy === "user")
          .map((node) => [node.type, node]),
      ),
    [],
  );

  const activeResult = results[activeIndex] ?? null;
  const keywords = useMemo(
    () => debouncedSearchTerm.split(/\s+/).filter(Boolean),
    [debouncedSearchTerm],
  );

  useEffect(() => {
    if (!isOpen) return;
    inputRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const timeout = setTimeout(
      () => setDebouncedSearchTerm(searchTerm.trim()),
      DEBOUNCE_MS,
    );
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (!isOpen) return;

    const query = debouncedSearchTerm;
    if (!query) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    void searchNodes(query)
      .then((newResults) => {
        if (cancelled) return;
        setResults(newResults);
        setActiveIndex(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchTerm, isOpen]);

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

  useEffect(() => {
    if (!activeResult) {
      setPreview(null);
      setIsPreviewLoading(false);
      return;
    }

    const cachedPreview = previewCacheRef.current.get(activeResult.uid);
    if (cachedPreview) {
      setPreview(cachedPreview);
      setIsPreviewLoading(false);
      return;
    }

    setPreview(null);
    setIsPreviewLoading(true);
    const timeout = setTimeout(() => {
      const nextPreview = getPreviewContent(
        activeResult.uid,
        activeResult.title,
      );
      previewCacheRef.current.set(activeResult.uid, nextPreview);
      setPreview(nextPreview);
      setIsPreviewLoading(false);
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [activeResult]);

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
    if (!debouncedSearchTerm) return "initial";
    if (isLoading) return "loading";
    if (!results.length) return "empty";
    return "results";
  }, [debouncedSearchTerm, isLoading, results.length]);

  return (
    <Dialog
      autoFocus={false}
      canEscapeKeyClose
      canOutsideClickClose
      className="roamjs-canvas-dialog"
      isOpen={isOpen}
      onClose={onClose}
      style={dialogStyle}
      title="Node Search"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => event.stopPropagation()}
        onMouseUp={(event) => event.stopPropagation()}
        style={{ pointerEvents: "all" }}
      >
        <div style={searchHeaderStyle}>
          <InputGroup
            fill
            inputRef={inputRef}
            leftIcon="search"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(event.target.value)
            }
            placeholder="Search nodes, pages, blocks..."
            value={searchTerm}
          />
          <Button icon="cross" minimal onClick={onClose} title="Close search" />
        </div>
        <div style={bodyStyle}>
          <div
            aria-label="Search results"
            ref={resultsPanelRef}
            role="listbox"
            style={resultsPanelStyle}
          >
            {contentState === "initial" && (
              <div style={emptyPanelStyle}>
                <NonIdealState title="Search DG nodes" />
              </div>
            )}
            {contentState === "loading" && (
              <div style={emptyPanelStyle}>
                <Spinner size={SpinnerSize.SMALL} />
              </div>
            )}
            {contentState === "empty" && (
              <div style={emptyPanelStyle}>
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
            isLoading={isPreviewLoading}
            keywords={keywords}
            nodeConfig={
              activeResult ? nodeConfigByType[activeResult.type] : undefined
            }
            preview={preview}
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

export default AdvancedNodeSearchDialog;
