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
import {
  getNodeTypeBadge,
  UNKNOWN_NODE_TYPE_BADGE,
  type NodeTypeBadge,
} from "~/utils/nodeTypeBadge";
import { fetchUserNames } from "~/utils/importNodes";
import { getLoggedInClient } from "~/utils/supabaseContext";

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

type NodeTypeDisplay = {
  name: string;
  badge: NodeTypeBadge;
};

const UNKNOWN_NODE_TYPE: NodeTypeDisplay = {
  name: "Unknown type",
  badge: UNKNOWN_NODE_TYPE_BADGE,
};

type SearchResultRow = RankedDiscourseNode & {
  nodeType: NodeTypeDisplay;
};

const LOCAL_AUTHOR_NAME = "You";
const UNRESOLVED_AUTHOR_NAME = "Unknown";

/** Frontmatter is untyped, so the raw value is narrowed by each caller. */
const getFrontmatterAuthorId = (app: App, file: TFile): unknown => {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter as
    | Record<string, unknown>
    | undefined;
  return frontmatter?.authorId;
};

/**
 * "You" belongs only to a note with no `authorId` at all — every note in an
 * unsynced vault. An id that is present but unresolvable stays "Unknown" rather
 * than claiming local authorship. `useAuthorNames` has already cached the
 * names, so this stays synchronous.
 */
const resolveAuthorName = ({
  app,
  file,
  userNames,
}: {
  app: App;
  file: TFile;
  userNames: Record<number, string>;
}): string => {
  const authorId = getFrontmatterAuthorId(app, file);
  if (authorId === undefined || authorId === null) return LOCAL_AUTHOR_NAME;
  if (typeof authorId !== "number") return UNRESOLVED_AUTHOR_NAME;
  return userNames[authorId] ?? UNRESOLVED_AUTHOR_NAME;
};

/**
 * `fetchUserNames` returns every person in the vault's spaces in one query, so
 * this refreshes once per open when a name is missing rather than querying per
 * author.
 */
const useAuthorNames = ({
  app,
  plugin,
  candidateState,
}: {
  app: App;
  plugin: DiscourseGraphPlugin;
  candidateState: CandidateState;
}): Record<number, string> => {
  const [userNames, setUserNames] = useState(plugin.settings.userNames ?? {});

  useEffect(() => {
    if (candidateState.status !== "ready") return;
    if (!plugin.settings.syncModeEnabled) return;

    const isMissingName = (candidate: DiscourseNodeCandidate): boolean => {
      const authorId = getFrontmatterAuthorId(app, candidate.file);
      return (
        typeof authorId === "number" && !plugin.settings.userNames?.[authorId]
      );
    };
    if (!candidateState.candidates.some(isMissingName)) return;

    let cancelled = false;
    void (async () => {
      const client = await getLoggedInClient(plugin);
      if (!client || cancelled) return;
      await fetchUserNames(plugin, client);
      if (!cancelled) setUserNames(plugin.settings.userNames ?? {});
    })();
    return () => {
      cancelled = true;
    };
  }, [app, plugin, candidateState]);

  return userNames;
};

const formatTimestamp = (epochMs: number): string =>
  new Date(epochMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

const PreviewPane = ({
  app,
  result,
  authorName,
}: {
  app: App;
  result: SearchResultRow | undefined;
  authorName: string;
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // Paired with its file so an in-flight read can't put one note's body under
  // another note's title.
  const [loaded, setLoaded] = useState<{ file: TFile; text: string } | null>(
    null,
  );

  const file = result?.file;

  useEffect(() => {
    if (!file) {
      setLoaded(null);
      return;
    }
    let cancelled = false;
    void app.vault.cachedRead(file).then((text) => {
      if (!cancelled) setLoaded({ file, text });
    });
    return () => {
      cancelled = true;
    };
  }, [app, file]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !file || loaded?.file !== file) return;

    container.empty();
    const component = new Component();
    void MarkdownRenderer.render(
      app,
      loaded.text.trim() || "This note is empty.",
      container,
      file.path,
      component,
    );

    return () => {
      component.unload();
      container.empty();
    };
  }, [app, file, loaded]);

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
          )} · ${authorName}`}
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
      className="dg-search-result-title text-normal min-w-0 flex-1 truncate"
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
          className={`border-modifier-border flex cursor-pointer items-center gap-2 border-b px-3 py-2 ${
            index === activeIndex ? "bg-modifier-hover" : ""
          }`}
        >
          <span
            title={result.nodeType.name}
            aria-label={result.nodeType.name}
            style={{
              backgroundColor: result.nodeType.badge.backgroundColor,
              color: result.nodeType.badge.textColor,
            }}
            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
          >
            {result.nodeType.badge.text}
          </span>
          <HighlightedTitle title={result.title} match={result.match} />
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
  const userNames = useAuthorNames({ app, plugin, candidateState });

  const nodeTypesById = useMemo(() => {
    const byId = new Map<string, NodeTypeDisplay>();
    plugin.settings.nodeTypes.forEach((nodeType, nodeIndex) => {
      byId.set(nodeType.id, {
        name: nodeType.name,
        badge: getNodeTypeBadge({ nodeType, nodeIndex }),
      });
    });
    return byId;
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
        nodeType: nodeTypesById.get(result.nodeTypeId) ?? UNKNOWN_NODE_TYPE,
      }));
  }, [candidateState, debouncedQuery, nodeTypesById]);

  const activeResult = results[activeIndex];

  // Only the preview shows an author, so resolve the selection, not all 50 rows.
  const authorName = useMemo(
    () =>
      activeResult
        ? resolveAuthorName({ app, file: activeResult.file, userNames })
        : "",
    [app, activeResult, userNames],
  );

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
        <PreviewPane app={app} result={activeResult} authorName={authorName} />
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
