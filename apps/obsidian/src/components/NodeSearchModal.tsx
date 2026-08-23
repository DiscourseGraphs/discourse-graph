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
  type MouseEvent,
  type ReactElement,
} from "react";
import { createRoot, Root } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import { NodeSearchFooter } from "~/components/NodeSearchFooter";
import { NodeTypeChipsSearchInput } from "~/components/NodeTypeChipsSearchInput";
import { NodeTypeFilterMenu } from "~/components/NodeTypeFilterMenu";
import {
  openFileInNewLeaf,
  openFileInNewTab,
} from "~/components/canvas/utils/openFileUtils";
import {
  insertLinkAtInsertTarget,
  snapshotInsertTarget,
  type EditorInsertTarget,
} from "~/utils/editorInsertTarget";
import {
  QueryEngine,
  rankDiscourseNodesByTitle,
  type DiscourseNodeCandidate,
  type RankedDiscourseNode,
} from "~/services/QueryEngine";
import {
  getNodeTypeBadge,
  getFallbackNodeTypeBadge,
  type NodeTypeBadge,
} from "~/utils/nodeTypeBadge";
import { fetchUserNames } from "~/utils/importNodes";
import { getLoggedInClient } from "~/utils/supabaseContext";

const MAX_VISIBLE_RESULTS = 50;
const SEARCH_DEBOUNCE_MS = 250;

type CandidateState =
  | { status: "loading" }
  | { status: "ready"; candidates: DiscourseNodeCandidate[] }
  | { status: "error"; message: string };

type NodeTypeDisplay = {
  name: string;
  /** Null when neither the config nor the title says what type this is. */
  badge: NodeTypeBadge | null;
};

type SearchResultRow = RankedDiscourseNode & {
  nodeType: NodeTypeDisplay;
};

const LOCAL_AUTHOR_NAME = "You";
const UNRESOLVED_AUTHOR_NAME = "Unknown";

/** Frontmatter is untyped, so the raw value is narrowed by each caller. */
const getFrontmatterAuthorId = (app: App, file: TFile): unknown => {
  const frontmatter: Record<string, unknown> | undefined =
    app.metadataCache.getFileCache(file)?.frontmatter;
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
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const active = listRef.current?.children[activeIndex];
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Scrolling drags rows under a stationary cursor, and the mouseenter that
  // fires is not a choice. Compare coordinates rather than resetting a flag on
  // every activation, so hovering from row to row still counts as a choice.
  const hasPointerMoved = (event: MouseEvent<HTMLDivElement>): boolean => {
    const previous = pointerPositionRef.current;
    pointerPositionRef.current = { x: event.clientX, y: event.clientY };
    return (
      previous === null ||
      previous.x !== event.clientX ||
      previous.y !== event.clientY
    );
  };

  return (
    // No `aria-label` here: Obsidian renders one as a hover tooltip, which
    // covers the results the moment the pointer enters the list.
    <div
      ref={listRef}
      role="listbox"
      onMouseMove={(event) => {
        hasPointerMoved(event);
      }}
      className="flex-1 overflow-y-auto"
    >
      {results.map((result, index) => (
        <div
          key={result.file.path}
          role="option"
          aria-selected={index === activeIndex}
          onMouseEnter={(event) => hasPointerMoved(event) && onActivate(index)}
          onClick={() => onActivate(index)}
          // Keeps focus in the search input, so the keyboard path stays live
          // after a click.
          onMouseDown={(event) => event.preventDefault()}
          className={`border-modifier-border flex cursor-pointer items-center gap-2 border-b px-3 py-2 ${
            index === activeIndex ? "bg-modifier-hover" : ""
          }`}
        >
          {result.nodeType.badge && (
            <span
              aria-label={result.nodeType.name}
              style={{
                backgroundColor: result.nodeType.badge.backgroundColor,
                color: result.nodeType.badge.textColor,
              }}
              className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold"
            >
              {result.nodeType.badge.text}
            </span>
          )}
          <HighlightedTitle title={result.title} match={result.match} />
        </div>
      ))}
    </div>
  );
};

const NodeSearch = ({
  plugin,
  insertTarget,
  onClose,
}: {
  plugin: DiscourseGraphPlugin;
  insertTarget: EditorInsertTarget | null;
  onClose: () => void;
}): ReactElement => {
  const { app } = plugin;
  const [candidateState, setCandidateState] = useState<CandidateState>({
    status: "loading",
  });
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // Single source of truth: ENG-2111's tag chips will read and write this too.
  const [selectedNodeTypeIds, setSelectedNodeTypeIds] = useState<string[]>([]);
  const [isTypeFilterOpen, setIsTypeFilterOpen] = useState(false);
  const inputRef = useRef<HTMLSpanElement | null>(null);
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
  // Effects run after paint, so the loading state still renders for a frame; if
  // this ever becomes a network call, only this body changes.
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
      nodeTypeIds: selectedNodeTypeIds,
    })
      .slice(0, MAX_VISIBLE_RESULTS)
      .map((result) => ({
        ...result,
        nodeType: nodeTypesById.get(result.nodeTypeId) ?? {
          name: "Unknown type",
          badge: getFallbackNodeTypeBadge(result.title),
        },
      }));
  }, [candidateState, debouncedQuery, nodeTypesById, selectedNodeTypeIds]);

  // A narrowing query rebuilds `results` before the effect below can reset the
  // state, so the old index can point past the new list for one render. Clamping
  // here keeps the preview and the highlighted row from blanking for that frame.
  const activeIndexInRange = activeIndex < results.length ? activeIndex : 0;
  const activeResult = results[activeIndexInRange];

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

  // Closes before opening: `close()` unmounts this React root, so the file and
  // app are read first and nothing touches state afterwards.
  const openActiveResult = (
    open: (app: App, file: TFile) => Promise<void>,
  ): void => {
    if (!activeResult) return;
    const { file } = activeResult;
    onClose();
    void open(app, file).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Could not open ${file.basename}: ${message}`);
    });
  };

  const handleTypeFilterOpenChange = (nextOpen: boolean): void => {
    setIsTypeFilterOpen(nextOpen);
    // Returns the keyboard path to the results the moment the panel closes.
    if (!nextOpen) inputRef.current?.focus();
  };

  // Closes before inserting, like `openActiveResult`.
  const insertLinkToActiveResult = (): void => {
    if (!activeResult || !insertTarget) return;
    const { file } = activeResult;
    onClose();
    try {
      insertLinkAtInsertTarget({ app, file, target: insertTarget });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Could not insert a link to ${file.basename}: ${message}`);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      // Otherwise the caret jumps to the start or end of the query.
      event.preventDefault();
      moveActiveIndex(event.key === "ArrowDown" ? 1 : -1);
      return;
    }

    if (event.key !== "Enter") return;
    // Enter also commits an IME candidate, which must not open a file.
    if (event.nativeEvent.isComposing) return;
    // activeResult is part of the gate so the chord is not claimed while the
    // results are still loading, matching the footer button's disabled state.
    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      insertTarget &&
      activeResult
    ) {
      event.preventDefault();
      insertLinkToActiveResult();
      return;
    }
    // Alt+Enter is left alone for the dock action.
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    // A footer button reached by Tab runs its own action on Enter. Preventing the
    // default here would suppress that click and open a new tab instead.
    if (
      event.target instanceof HTMLElement &&
      event.target.closest("button") !== null
    ) {
      return;
    }

    event.preventDefault();
    openActiveResult(event.shiftKey ? openFileInNewLeaf : openFileInNewTab);
  };

  return (
    // Bound here rather than on the input so navigation survives focus moving
    // elsewhere in the modal, and so result actions have one place to live.
    <div className="flex h-full flex-col" onKeyDown={handleKeyDown}>
      {/* Padded so the filter trigger's count badge, which sits outside the
          button box, is not clipped by the modal's overflow-hidden content. */}
      {/* Top-aligned: the field grows downwards, so the trigger stays on its first line. */}
      <div className="flex items-start gap-2 px-1 pt-1">
        <NodeTypeChipsSearchInput
          inputRef={inputRef}
          nodeTypes={plugin.settings.nodeTypes}
          onQueryChange={setQuery}
          onSelectedNodeTypeIdsChange={setSelectedNodeTypeIds}
          query={query}
          selectedNodeTypeIds={selectedNodeTypeIds}
        />
        <NodeTypeFilterMenu
          app={app}
          isOpen={isTypeFilterOpen}
          nodeTypes={plugin.settings.nodeTypes}
          onOpenChange={handleTypeFilterOpenChange}
          onSelectedNodeTypeIdsChange={setSelectedNodeTypeIds}
          selectedNodeTypeIds={selectedNodeTypeIds}
        />
      </div>
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
              activeIndex={activeIndexInRange}
              onActivate={setActiveIndex}
            />
          )}
        </div>
        <PreviewPane app={app} result={activeResult} authorName={authorName} />
      </div>
      <NodeSearchFooter
        canAct={candidateState.status === "ready" && !!activeResult}
        canInsertLink={!!insertTarget}
        onClose={onClose}
        onInsertLink={insertLinkToActiveResult}
        onOpenInNewTab={() => openActiveResult(openFileInNewTab)}
        onOpenInSplit={() => openActiveResult(openFileInNewLeaf)}
      />
    </div>
  );
};

export class NodeSearchModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;
  /** Snapshotted in the constructor: `open()` has not taken focus yet. */
  private insertTarget: EditorInsertTarget | null;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
    this.insertTarget = snapshotInsertTarget(app);
  }

  onOpen() {
    const { contentEl, modalEl } = this;
    // The default modal is too narrow for a result list beside a preview pane.
    // Responsive layout is an explicit non-goal, so this is a desktop-only size.
    modalEl.addClasses([
      "dg-node-search-modal",
      "h-[600px]",
      "max-h-[80vh]",
      "w-[900px]",
      "max-w-[90vw]",
    ]);
    contentEl.addClasses(["flex", "h-full", "flex-col", "overflow-hidden"]);
    contentEl.empty();
    this.root = createRoot(contentEl);
    this.root.render(
      <StrictMode>
        <NodeSearch
          plugin={this.plugin}
          insertTarget={this.insertTarget}
          onClose={() => this.close()}
        />
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
