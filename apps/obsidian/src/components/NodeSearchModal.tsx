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
  Component as ReactComponent,
  StrictMode,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createRoot, Root } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import { NodeDisplayOptionsMenu } from "~/components/NodeDisplayOptionsMenu";
import { NodeSearchFooter } from "~/components/NodeSearchFooter";
import { NodeSortMenu } from "~/components/NodeSortMenu";
import {
  NodeTypeChipsSearchInput,
  setCaretToEnd,
} from "~/components/NodeTypeChipsSearchInput";
import { NodeTypeFilterMenu } from "~/components/NodeTypeFilterMenu";
import { NodeTypeFilterTags } from "~/components/NodeTypeFilterTags";
import type { SearchDropdownId } from "~/components/SearchDropdown";
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
import {
  buildAuthorNameByPath,
  resolveAuthorName,
  useAuthorNames,
} from "~/utils/discourseNodeAuthor";
import {
  DEFAULT_SORT_DIRECTION,
  DEFAULT_SORT_KEY,
  sortSearchResults,
  type SortDirection,
  type SortKey,
} from "~/utils/discourseNodeSort";

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
  /** The configured tag, untruncated — a tag result's badge shows this in full. */
  tag?: string;
};

type SearchResultRow = RankedDiscourseNode & {
  nodeType: NodeTypeDisplay;
};

const formatTimestamp = (epochMs: number): string =>
  new Date(epochMs).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/**
 * `PreviewPane` does its own imperative DOM work (`container.empty()`,
 * `MarkdownRenderer.render`, image-load waiting, WAAPI animation) alongside
 * React's own rendering of the same subtree — racy by nature, and Obsidian's
 * async embed/image rendering can still be mutating that DOM after a rapid
 * result change has already torn it down, which surfaces as a React
 * reconciliation crash ("removeChild... not a child of this node") with no
 * clean fix available from inside the effect itself. Scoped here rather than
 * around the whole modal, so a crash takes out only the (non-essential)
 * preview — search, filters, and the result list stay fully usable.
 *
 * Not remounted (via a `key`) when the previewed result changes: a keyed
 * boundary is itself torn down on that change, so an error thrown while
 * React deletes its *old* subtree has no mounted boundary left to catch it —
 * defeating the fix for exactly the race this component exists to contain.
 * Instead this instance stays mounted across every result change, and resets
 * itself when `resetKey` changes so a later selection can still retry after
 * a crash. The reset lives in `getDerivedStateFromProps` (compared against
 * the *stored* `resetKey`, not the previous render's), not
 * `componentDidUpdate` comparing consecutive props: if the newly-selected
 * result itself throws, a plain "did resetKey change since last render"
 * check would clear `hasError` again on the very next update — even though
 * `resetKey` hasn't moved on since — reopening the same crash in a loop.
 */
class PreviewErrorBoundary extends ReactComponent<
  { children: ReactNode; resetKey: string },
  { hasError: boolean; resetKey: string }
> {
  state = { hasError: false, resetKey: this.props.resetKey };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  static getDerivedStateFromProps(
    props: { resetKey: string },
    state: { hasError: boolean; resetKey: string },
  ): { hasError: boolean; resetKey: string } | null {
    if (props.resetKey === state.resetKey) return null;
    return { hasError: false, resetKey: props.resetKey };
  }

  componentDidCatch(error: unknown): void {
    console.error("Node search preview failed to render:", error);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="text-muted flex flex-1 items-center justify-center p-4 text-center">
          Could not render this preview.
        </div>
      );
    }
    return this.props.children;
  }
}

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
          // A file can hold several tagged lines (or a tag alongside its own
          // node candidate), so the path alone isn't unique — and a single
          // line can itself carry more than one configured node-type tag, so
          // the line number alone isn't either; nodeTypeId disambiguates that
          // case.
          key={`${result.file.path}#${result.tagLine?.lineNumber ?? "node"}#${result.nodeTypeId}`}
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
          <div className="min-w-0 flex-1">
            <HighlightedTitle title={result.title} match={result.match} />
            {/* A tagged line's file isn't its own title, unlike a node file — so name it. */}
            {result.tagLine && (
              <div className="text-muted truncate text-[length:var(--font-ui-smaller)]">
                {result.file.basename}
              </div>
            )}
          </div>
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
  // `null` until "Show tags" is turned on for the first time — the scan is
  // vault-wide, so it's not worth paying for until the toggle asks for it.
  const [tagCandidateState, setTagCandidateState] =
    useState<CandidateState | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  // Single source of truth: ENG-2111's tag chips will read and write this too.
  const [selectedNodeTypeIds, setSelectedNodeTypeIds] = useState<string[]>([]);
  // One value per toolbar, so two panels can never be open at once.
  const [openDropdown, setOpenDropdown] = useState<SearchDropdownId>(null);
  const [sortKey, setSortKey] = useState<SortKey>(DEFAULT_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(
    DEFAULT_SORT_DIRECTION,
  );
  // An editable span, so the query shares its line boxes with the filter chips.
  const inputRef = useRef<HTMLSpanElement | null>(null);
  const userNames = useAuthorNames({
    app,
    plugin,
    candidates:
      candidateState.status === "ready" ? candidateState.candidates : null,
  });

  const nodeTypesById = useMemo(() => {
    const byId = new Map<string, NodeTypeDisplay>();
    plugin.settings.nodeTypes.forEach((nodeType, nodeIndex) => {
      byId.set(nodeType.id, {
        name: nodeType.name,
        badge: getNodeTypeBadge({ nodeType, nodeIndex }),
        tag: nodeType.tag,
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

  // Fetches once, on the first flip to `true`; the fetched candidates stay
  // cached in state so toggling back off/on doesn't rescan the vault. A ref
  // (not `tagCandidateState` itself) guards the fetch, so setting that state
  // below doesn't re-trigger this effect and cancel its own in-flight read.
  const hasFetchedTagCandidatesRef = useRef(false);
  useEffect(() => {
    if (!showTags || hasFetchedTagCandidatesRef.current) return;
    hasFetchedTagCandidatesRef.current = true;
    let cancelled = false;
    setTagCandidateState({ status: "loading" });
    void new QueryEngine(app)
      .getDiscourseTagCandidates(plugin.settings.nodeTypes)
      .then((candidates) => {
        if (!cancelled) setTagCandidateState({ status: "ready", candidates });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Unexpected error";
        new Notice(`Could not load tagged lines: ${message}`);
        setTagCandidateState({ status: "error", message });
      });
    return () => {
      cancelled = true;
    };
  }, [app, plugin.settings.nodeTypes, showTags]);

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebouncedQuery(query),
      SEARCH_DEBOUNCE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [query]);

  // Sort before truncating, so a date or alphabetical sort covers every match.
  const results = useMemo<SearchResultRow[]>(() => {
    if (candidateState.status !== "ready") return [];
    const tagCandidates =
      showTags && tagCandidateState?.status === "ready"
        ? tagCandidateState.candidates
        : [];
    const ranked = rankDiscourseNodesByTitle({
      candidates: [...candidateState.candidates, ...tagCandidates],
      query: debouncedQuery,
      nodeTypeIds: selectedNodeTypeIds,
    });
    const authorNameByPath =
      sortKey === "author"
        ? buildAuthorNameByPath({
            app,
            files: ranked.map((result) => result.file),
            userNames,
          })
        : undefined;
    return sortSearchResults({
      results: ranked,
      sortKey,
      direction: sortDirection,
      authorNameByPath,
    })
      .slice(0, MAX_VISIBLE_RESULTS)
      .map((result) => {
        const nodeType = nodeTypesById.get(result.nodeTypeId) ?? {
          name: "Unknown type",
          badge: getFallbackNodeTypeBadge(result.title),
        };
        // A tag result's badge shows the full configured tag, not the node
        // type's usual truncated-to-3-characters badge.
        const badge =
          result.tagLine && nodeType.badge && nodeType.tag
            ? { ...nodeType.badge, text: nodeType.tag }
            : nodeType.badge;
        return { ...result, nodeType: { ...nodeType, badge } };
      });
  }, [
    app,
    candidateState,
    debouncedQuery,
    nodeTypesById,
    selectedNodeTypeIds,
    showTags,
    sortDirection,
    sortKey,
    tagCandidateState,
    userNames,
  ]);

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
    open: (app: App, file: TFile, line?: number) => Promise<void>,
  ): void => {
    if (!activeResult) return;
    const { file } = activeResult;
    const line = activeResult.tagLine?.lineNumber;
    onClose();
    void open(app, file, line).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Could not open ${file.basename}: ${message}`);
    });
  };

  const handleDropdownOpenChange = ({
    id,
    isOpen,
  }: {
    id: NonNullable<SearchDropdownId>;
    isOpen: boolean;
  }): void => {
    setOpenDropdown(isOpen ? id : null);
    if (isOpen) return;
    // Deferred a tick: both Escape (Obsidian's keymap, not a React event) and
    // this panel's own unmount can revert focus to `document.body` after this
    // function returns, not synchronously within it — checking right away could
    // read a stale `activeElement` from just before that settles.
    window.setTimeout(() => {
      // Escape and an outside click leave focus stranded on `document.body`
      // (the panel's own focused content just unmounted) — reclaim it there so
      // the keyboard path back to the results isn't lost. But tabbing past the
      // panel already moves focus forward on its own (to the next toolbar
      // button); reclaiming unconditionally would fight that and bounce focus
      // backward instead of letting it land where Tab was already taking it.
      if (activeDocument.activeElement === activeDocument.body) {
        inputRef.current?.focus();
      }
    }, 0);
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
      {/* Padded so a trigger's count badge is not clipped by the modal's overflow-hidden content. */}
      {/* Top-aligned: the field grows downwards, so the triggers stay on its first line. */}
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
          isOpen={openDropdown === "type-filter"}
          nodeTypes={plugin.settings.nodeTypes}
          onOpenChange={(isOpen) =>
            handleDropdownOpenChange({ id: "type-filter", isOpen })
          }
          onSelectedNodeTypeIdsChange={setSelectedNodeTypeIds}
          selectedNodeTypeIds={selectedNodeTypeIds}
        />
        <NodeDisplayOptionsMenu
          app={app}
          isOpen={openDropdown === "display-options"}
          onOpenChange={(isOpen) =>
            handleDropdownOpenChange({ id: "display-options", isOpen })
          }
          onShowTagsChange={setShowTags}
          showTags={showTags}
        />
        <NodeSortMenu
          app={app}
          isOpen={openDropdown === "sort"}
          onOpenChange={(isOpen) =>
            handleDropdownOpenChange({ id: "sort", isOpen })
          }
          onSortChange={({ sortKey: nextKey, direction }) => {
            setSortKey(nextKey);
            setSortDirection(direction);
          }}
          sortDirection={sortDirection}
          sortKey={sortKey}
        />
      </div>
      <div className="border-modifier-border mt-3 flex flex-1 overflow-hidden rounded border">
        <div className="border-modifier-border flex w-2/5 flex-col border-r">
          <NodeTypeFilterTags
            focusSearchInput={() => {
              const field = inputRef.current;
              if (!field) return;
              field.focus();
              setCaretToEnd(field);
            }}
            nodeTypes={plugin.settings.nodeTypes}
            onSelectedNodeTypeIdsChange={setSelectedNodeTypeIds}
            selectedNodeTypeIds={selectedNodeTypeIds}
          />
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
        <PreviewErrorBoundary
          // Resets (clearing any prior crash) whenever the previewed result
          // itself changes, not just when its data does. Not a `key`: see
          // the class doc comment for why this boundary must stay mounted
          // across that change rather than remount.
          resetKey={activeResult ? activeResult.file.path : "none"}
        >
          <PreviewPane app={app} result={activeResult} authorName={authorName} />
        </PreviewErrorBoundary>
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
