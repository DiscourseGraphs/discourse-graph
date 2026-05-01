import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { Dialog } from "@blueprintjs/core";
import MiniSearch from "minisearch";
import renderOverlay from "roamjs-components/util/renderOverlay";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { getAllDiscourseNodesSince } from "~/utils/getAllDiscourseNodesSince";
import {
  type SearchResult,
  type Sort,
  type NodeTypeConfig,
  buildNodeTypeConfigs,
} from "./types";
import ChipsSearchInput from "./ChipsSearchInput";
import ResultRow from "./ResultRow";
import PreviewPane from "./PreviewPane";
import { FilterPopover, SortDropdown, HelpPopover } from "./FilterPopover";

const MIN_SEARCH_SCORE = 0.1;

/* ── Icons ───────────────────────────────────────────────────── */

const SearchIcon = () => (
  <svg
    className="dg-as-search-icon"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const FilterIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

const SortIcon = () => (
  <svg
    width="12"
    height="14"
    viewBox="0 0 12 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3.5 2.5 L3.5 11.5 M1.5 4.5 L3.5 2.5 L5.5 4.5" />
    <path d="M8.5 11.5 L8.5 2.5 M6.5 9.5 L8.5 11.5 L10.5 9.5" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 4.5 L6 7.5 L9 4.5" />
  </svg>
);

const HelpIcon = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

/* ── Detect current-graph UIDs ───────────────────────────────── */

const buildCurrentGraphUidSet = (): Set<string> => {
  try {
    const results = window.roamAlphaAPI.q(
      "[:find ?uid :where [?e :block/uid ?uid] [?e :node/title _]]",
    ) as [string][];
    return new Set(results.map(([uid]) => uid));
  } catch {
    return new Set();
  }
};

/* ── Sort results ────────────────────────────────────────────── */

const sortResults = (results: SearchResult[], sort: Sort): SearchResult[] => {
  const sorted = [...results];
  if (sort.key === "alphabetical") {
    sorted.sort((a, b) => a.title.localeCompare(b.title));
    if (sort.dir === "desc") sorted.reverse();
  } else if (sort.key === "most_connected") {
    sorted.sort((a, b) => b.refs - a.refs);
  } else if (sort.key === "date_modified" || sort.key === "date_created") {
    sorted.sort((a, b) => {
      const ta = new Date(a.lastModified).getTime();
      const tb = new Date(b.lastModified).getTime();
      return sort.dir === "desc" ? tb - ta : ta - tb;
    });
  }
  return sorted;
};

/* ── Main Dialog ─────────────────────────────────────────────── */

type Props = {
  isOpen: boolean;
  onClose: () => void;
};

type MiniSearchDoc = {
  uid: string;
  title: string;
  type: string;
};

const AdvancedSearchDialog = ({ isOpen, onClose }: Props) => {
  const [chips, setChips] = useState<string[]>([]);
  const [value, setValue] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [showFilterPop, setShowFilterPop] = useState(false);
  const [showSort, setShowSort] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sort, setSort] = useState<Sort>({ key: "relevance", dir: "desc" });
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [typeConfigs, setTypeConfigs] = useState<NodeTypeConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const miniSearch = useRef<MiniSearch<MiniSearchDoc> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);

  // Load all nodes on mount
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      try {
        const discourseNodes = getDiscourseNodes();
        const configs = buildNodeTypeConfigs(discourseNodes);
        const rawData = await getAllDiscourseNodesSince(
          undefined,
          discourseNodes,
        );
        if (cancelled) return;

        const currentGraphUids = buildCurrentGraphUidSet();

        const results: SearchResult[] = rawData.map((r) => ({
          uid: r.source_local_id,
          title: r.text,
          type: r.type,
          refs: 0,
          lastModified: r.last_modified,
          authorName: r.author_name,
          fromCurrentGraph: currentGraphUids.has(r.source_local_id),
        }));

        const ms = new MiniSearch<MiniSearchDoc>({
          fields: ["title"],
          storeFields: ["uid", "title", "type"],
          idField: "uid",
        });
        ms.addAll(
          results.map(({ uid, title, type }) => ({ uid, title, type })),
        );
        miniSearch.current = ms;

        setTypeConfigs(configs);
        setAllResults(results);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Parse keywords from input
  const keywords = useMemo(
    () => value.trim().split(/\s+/).filter(Boolean),
    [value],
  );

  // Filtered + sorted results
  const results = useMemo((): SearchResult[] => {
    const ms = miniSearch.current;
    let filtered: SearchResult[];

    if (!ms) return [];

    if (keywords.length > 0) {
      const hits = ms.search(keywords.join(" "), {
        prefix: true,
        fuzzy: 0.2,
        combineWith: "AND",
        filter:
          chips.length > 0
            ? (result) =>
                chips.includes((result as unknown as MiniSearchDoc).type)
            : undefined,
      });
      const hitUids = new Set(
        hits.filter((h) => h.score >= MIN_SEARCH_SCORE).map((h) => h.id),
      );
      filtered = allResults.filter((r) => hitUids.has(r.uid));
    } else if (chips.length > 0) {
      filtered = allResults.filter((r) => chips.includes(r.type));
    } else {
      filtered = allResults;
    }

    return sortResults(filtered, sort);
  }, [allResults, chips, keywords, sort]);

  // Clamp activeIdx when results change
  useEffect(() => {
    setActiveIdx((prev) =>
      results.length === 0 ? 0 : Math.min(prev, results.length - 1),
    );
  }, [results.length]);

  // Scroll active row into view
  useEffect(() => {
    const panel = resultsRef.current;
    if (!panel) return;
    const active = panel.querySelector(
      ".dg-as-result.active",
    ) as HTMLElement | null;
    if (!active) return;
    const pr = panel.getBoundingClientRect();
    const er = active.getBoundingClientRect();
    if (er.top < pr.top) panel.scrollTop -= pr.top - er.top + 4;
    else if (er.bottom > pr.bottom)
      panel.scrollTop += er.bottom - pr.bottom + 4;
  }, [activeIdx]);

  const typeConfigsById = useMemo(
    () => Object.fromEntries(typeConfigs.map((t) => [t.id, t])),
    [typeConfigs],
  );

  const currentSortLabel = useMemo(() => {
    const labels: Record<string, string> = {
      relevance: "Relevance",
      date_modified: "Date modified",
      date_created: "Date created",
      alphabetical: "Alphabetical",
      most_connected: "Most connected",
    };
    return labels[sort.key] ?? "Relevance";
  }, [sort.key]);

  const closePopovers = useCallback(() => {
    setShowFilterPop(false);
    setShowSort(false);
    setShowHelp(false);
  }, []);

  const handleEscape = useCallback(() => {
    if (showFilterPop || showSort || showHelp) {
      closePopovers();
    } else {
      onClose();
    }
  }, [showFilterPop, showSort, showHelp, closePopovers, onClose]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canOutsideClickClose
      canEscapeKeyClose={false} // handled manually to close popovers first
      className="dg-adv-search-dialog"
      portalClassName="dg-adv-search-portal"
    >
      <div
        className="dg-as-modal"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            handleEscape();
          }
        }}
      >
        {/* Search row */}
        <div className="dg-as-search-row">
          <SearchIcon />
          <ChipsSearchInput
            chips={chips}
            setChips={setChips}
            value={value}
            setValue={setValue}
            types={typeConfigs}
            inputRef={inputRef}
            onArrowDown={() =>
              setActiveIdx((i) => Math.min(i + 1, results.length - 1))
            }
            onArrowUp={() => setActiveIdx((i) => Math.max(i - 1, 0))}
            onEnter={() => {
              /* TODO ENG-1682 */
            }}
            onShiftEnter={() => {
              /* TODO ENG-1682 */
            }}
            onCmdEnter={() => {
              /* TODO ENG-1682 */
            }}
            onEscape={handleEscape}
          />
          <div className="dg-as-actions">
            <button
              ref={filterTriggerRef}
              className={`dg-as-icon-btn${showFilterPop || chips.length > 0 ? "active" : ""}`}
              onClick={() => {
                setShowFilterPop((s) => !s);
                setShowSort(false);
                setShowHelp(false);
              }}
              aria-label="Filter by type"
              aria-expanded={showFilterPop}
            >
              <FilterIcon />
              {chips.length > 0 && (
                <span className="dg-as-count-pill">{chips.length}</span>
              )}
            </button>

            <button
              ref={sortTriggerRef}
              className={`dg-as-sort-pill${showSort ? "active" : ""}`}
              onClick={() => {
                setShowSort((s) => !s);
                setShowFilterPop(false);
                setShowHelp(false);
              }}
              aria-label="Sort"
              aria-expanded={showSort}
            >
              <SortIcon />
              <span>{currentSortLabel}</span>
              <ChevronDownIcon />
            </button>

            <button
              ref={helpTriggerRef}
              className={`dg-as-icon-btn${showHelp ? "active" : ""}`}
              onClick={() => {
                setShowHelp((s) => !s);
                setShowFilterPop(false);
                setShowSort(false);
              }}
              aria-label="Keyboard shortcuts"
            >
              <HelpIcon />
            </button>
          </div>

          {showFilterPop && (
            <FilterPopover
              types={typeConfigs}
              chips={chips}
              setChips={setChips}
              triggerRef={filterTriggerRef}
              onClose={() => setShowFilterPop(false)}
            />
          )}
          {showSort && (
            <SortDropdown
              sort={sort}
              setSort={setSort}
              triggerRef={sortTriggerRef}
              onClose={() => setShowSort(false)}
            />
          )}
          {showHelp && (
            <HelpPopover
              types={typeConfigs}
              triggerRef={helpTriggerRef}
              onClose={() => setShowHelp(false)}
            />
          )}
        </div>

        {/* Split body */}
        <div className="dg-as-body">
          {/* Left: results list */}
          <div className="dg-as-results-panel" ref={resultsRef} role="listbox">
            {isLoading ? (
              <div className="dg-as-results-loading">Loading nodes…</div>
            ) : results.length === 0 ? (
              <div className="dg-as-results-empty">
                No matches. Try removing a filter or keyword.
              </div>
            ) : (
              results.map((r, i) => (
                <ResultRow
                  key={r.uid}
                  result={r}
                  typeConfig={typeConfigsById[r.type]}
                  active={i === activeIdx}
                  keywords={keywords}
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => setActiveIdx(i)}
                />
              ))
            )}
          </div>

          {/* Right: preview */}
          <PreviewPane
            result={results[activeIdx] ?? null}
            typeConfig={
              results[activeIdx]
                ? (typeConfigsById[results[activeIdx].type] ?? null)
                : null
            }
            keywords={keywords}
          />
        </div>

        {/* Footer */}
        <div className="dg-as-footer">
          <span className="dg-as-footer-keys">
            <span className="dg-as-key-group">
              <kbd>↑</kbd>
              <kbd>↓</kbd> navigate
            </span>
            <span className="dg-as-key-group">
              <kbd>↵</kbd> sidebar
            </span>
            <span className="dg-as-key-group">
              <kbd>⇧↵</kbd> main
            </span>
            <span className="dg-as-key-group">
              <kbd>⌘↵</kbd> open all
            </span>
          </span>
          <span className="dg-as-key-group">
            <kbd>esc</kbd> close
          </span>
        </div>
      </div>
    </Dialog>
  );
};

export const renderAdvancedSearchDialog = () =>
  renderOverlay({ Overlay: AdvancedSearchDialog, props: {} });
