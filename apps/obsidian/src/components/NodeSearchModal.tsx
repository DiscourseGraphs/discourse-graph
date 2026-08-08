import {
  App,
  Component,
  MarkdownRenderer,
  Modal,
  Notice,
  renderResults,
  TFile,
  type SearchResult,
} from "obsidian";
import {
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { createRoot, Root } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import {
  QueryEngine,
  rankDiscourseNodesByTitle,
  type DiscourseNodeCandidate,
  type RankedDiscourseNode,
} from "~/services/QueryEngine";

const MAX_VISIBLE_RESULTS = 50;
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Loading and error are unreachable today, since `getDiscourseNodeCandidates` is
 * synchronous and swallows Datacore failures. They exist because semantic search
 * (F12) queries Supabase over the network, and threading those states through
 * every render branch later costs far more than carrying them now.
 */
type CandidateState =
  | { status: "loading" }
  | { status: "ready"; candidates: DiscourseNodeCandidate[] }
  | { status: "error"; message: string };

type SearchResultRow = RankedDiscourseNode & {
  nodeTypeName: string;
  authorName: string;
};

/**
 * A local note is authored by whoever is using the vault; only imported nodes
 * carry an `authorId`, and resolving that to a display name is deferred to v1+.
 */
const resolveAuthorName = (app: App, file: TFile): string => {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter as
    | Record<string, unknown>
    | undefined;
  return frontmatter?.authorId === undefined ? "You" : "Unknown";
};

const formatTimestamp = (epochMs: number): string =>
  new Date(epochMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const PreviewPane = ({
  app,
  result,
}: {
  app: App;
  result: SearchResultRow | undefined;
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [content, setContent] = useState<string | null>(null);

  const file = result?.file;

  useEffect(() => {
    if (!file) {
      setContent(null);
      return;
    }
    let cancelled = false;
    void app.vault.cachedRead(file).then((text) => {
      if (!cancelled) setContent(text);
    });
    return () => {
      cancelled = true;
    };
  }, [app, file]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !file || content === null) return;

    container.empty();
    const component = new Component();
    void MarkdownRenderer.render(
      app,
      content.trim() || "This note is empty.",
      container,
      file.path,
      component,
    );

    return () => {
      component.unload();
      container.empty();
    };
  }, [app, file, content]);

  if (!result || !file) {
    return (
      <div className="text-muted flex flex-1 items-center justify-center">
        Select a result to preview it.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-modifier-border border-b px-4 py-3">
        <div className="text-normal font-semibold">{result.title}</div>
        <div className="text-muted mt-1 text-xs">
          {`Created ${formatTimestamp(file.stat.ctime)} · Modified ${formatTimestamp(
            file.stat.mtime,
          )} · ${result.authorName}`}
        </div>
      </div>
      <div
        ref={containerRef}
        className="text-normal flex-1 overflow-y-auto px-4 py-3"
      />
    </div>
  );
};

/**
 * `renderResults` slices `title` using the offsets in `match`, so it must be
 * handed the exact string that was scored. It also applies the theme's own
 * highlight styling, which is why matches are not marked up by hand.
 */
const HighlightedTitle = ({
  title,
  match,
}: {
  title: string;
  match: SearchResult;
}): ReactElement => {
  const titleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = titleRef.current;
    if (!container) return;
    container.empty();
    renderResults(container, title, match);
    return () => container.empty();
  }, [title, match]);

  return (
    <div
      ref={titleRef}
      className="dg-search-result-title text-normal truncate"
    />
  );
};

const ResultList = ({
  results,
  activeIndex,
  onActivate,
}: {
  results: SearchResultRow[];
  activeIndex: number;
  onActivate: (index: number) => void;
}): ReactElement => {
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const active = listRef.current?.children[activeIndex];
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Discourse node search results"
      className="flex-1 overflow-y-auto"
    >
      {results.map((result, index) => (
        <div
          key={result.file.path}
          role="option"
          aria-selected={index === activeIndex}
          onClick={() => onActivate(index)}
          className={`border-modifier-border cursor-pointer border-b px-3 py-2 ${
            index === activeIndex ? "bg-modifier-hover" : ""
          }`}
        >
          <HighlightedTitle title={result.title} match={result.match} />
          <div className="text-muted mt-0.5 text-xs">{result.nodeTypeName}</div>
        </div>
      ))}
    </div>
  );
};

const NodeSearch = ({
  plugin,
}: {
  plugin: DiscourseGraphPlugin;
}): ReactElement => {
  const { app } = plugin;
  const [candidateState, setCandidateState] = useState<CandidateState>({
    status: "loading",
  });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const nodeTypeNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const nodeType of plugin.settings.nodeTypes) {
      names.set(nodeType.id, nodeType.name);
    }
    return names;
  }, [plugin.settings.nodeTypes]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // The fetch is synchronous today, so there is nothing to await or cancel yet.
  // Effects run after paint, so the loading state still renders for a frame; when
  // F12 makes this a network call, only this body changes.
  useEffect(() => {
    try {
      const candidates = new QueryEngine(app).getDiscourseNodeCandidates();
      setCandidateState({ status: "ready", candidates });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unexpected error";
      new Notice(`Could not load discourse nodes: ${message}`);
      setCandidateState({ status: "error", message });
    }
  }, [app]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  const results = useMemo<SearchResultRow[]>(() => {
    if (candidateState.status !== "ready") return [];
    return rankDiscourseNodesByTitle({
      candidates: candidateState.candidates,
      query: debouncedQuery,
    })
      .slice(0, MAX_VISIBLE_RESULTS)
      .map((result) => ({
        ...result,
        nodeTypeName: nodeTypeNames.get(result.nodeTypeId) ?? "Unknown type",
        authorName: resolveAuthorName(app, result.file),
      }));
  }, [app, candidateState, debouncedQuery, nodeTypeNames]);

  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  const moveActiveIndex = (delta: number) => {
    if (!results.length) return;
    setActiveIndex((current) => {
      const next = current + delta;
      if (next < 0) return 0;
      if (next > results.length - 1) return results.length - 1;
      return next;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    // Otherwise the caret jumps to the start or end of the query.
    event.preventDefault();
    moveActiveIndex(event.key === "ArrowDown" ? 1 : -1);
  };

  return (
    <div className="flex h-full flex-col">
      <input
        ref={inputRef}
        type="text"
        value={query}
        placeholder="Search discourse nodes by title"
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        className="w-full"
      />
      <div className="border-modifier-border mt-3 flex flex-1 overflow-hidden rounded border">
        <div className="border-modifier-border flex w-2/5 flex-col border-r">
          {candidateState.status === "loading" && (
            <div className="text-muted p-4">Loading discourse nodes…</div>
          )}
          {candidateState.status === "error" && (
            <div className="text-error p-4">
              Could not load discourse nodes. {candidateState.message}
            </div>
          )}
          {candidateState.status === "ready" && results.length === 0 && (
            <div className="text-muted p-4">No results</div>
          )}
          {candidateState.status === "ready" && results.length > 0 && (
            <ResultList
              results={results}
              activeIndex={activeIndex}
              onActivate={setActiveIndex}
            />
          )}
        </div>
        <PreviewPane app={app} result={results[activeIndex]} />
      </div>
    </div>
  );
};

export class NodeSearchModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("dg-node-search-modal");
    contentEl.empty();
    this.root = createRoot(contentEl);
    this.root.render(
      <StrictMode>
        <NodeSearch plugin={this.plugin} />
      </StrictMode>,
    );
  }

  onClose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    this.contentEl.empty();
  }
}
