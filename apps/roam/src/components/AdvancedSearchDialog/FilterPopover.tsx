import React, {
  useState,
  useEffect,
  useRef,
  useLayoutEffect,
  type RefObject,
} from "react";
import ReactDOM from "react-dom";
import {
  type NodeTypeConfig,
  type Sort,
  type SortKey,
  type SortDir,
} from "./types";

/* ── Helpers ─────────────────────────────────────────────────── */

type PopoverPosition = { top: number; left: number };

const computePosition = (
  triggerRef: RefObject<HTMLElement>,
  width: number,
): PopoverPosition => {
  if (!triggerRef.current) return { top: 0, left: 0 };
  const rect = triggerRef.current.getBoundingClientRect();
  const left = Math.max(
    8,
    Math.min(rect.right - width, window.innerWidth - width - 8),
  );
  const top = rect.bottom + 8;
  return { top, left };
};

/* ── Checkbox ────────────────────────────────────────────────── */

type CheckState = "off" | "indeterminate" | "on";

const Checkbox = ({ state }: { state: CheckState }) => (
  <span className={`dg-as-cb ${state === "off" ? "" : state}`}>
    {state === "on" && (
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="2,5 4.5,7.5 8,3" />
      </svg>
    )}
  </span>
);

/* ── Filter Popover ──────────────────────────────────────────── */

type FilterPopoverProps = {
  types: NodeTypeConfig[];
  chips: string[];
  setChips: (chips: string[]) => void;
  triggerRef: RefObject<HTMLElement>;
  onClose: () => void;
};

export const FilterPopover = ({
  types,
  chips,
  setChips,
  triggerRef,
  onClose,
}: FilterPopoverProps) => {
  const [query, setQuery] = useState("");
  const [pos, setPos] = useState<PopoverPosition>({ top: 0, left: 0 });
  const popRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const nodeTypes = types.filter((t) => t.kind === "node");
  const otherTypes = types.filter((t) => t.kind !== "node");

  const filtered = query.trim()
    ? types.filter((t) => t.label.toLowerCase().includes(query.toLowerCase()))
    : null; // null = show all sections

  const displayTypes = filtered ?? types;
  const displayNodeTypes = filtered ? filtered : nodeTypes;
  const displayOtherTypes = filtered ? [] : otherTypes;

  // Select-all state
  const selectedCount = chips.length;
  const totalCount = types.length;
  const selectAllState: CheckState =
    selectedCount === 0
      ? "off"
      : selectedCount === totalCount
        ? "on"
        : "indeterminate";

  const handleSelectAll = () => {
    if (selectAllState === "off") setChips(types.map((t) => t.id));
    else setChips([]);
  };

  const toggleType = (id: string) => {
    setChips(
      chips.includes(id) ? chips.filter((c) => c !== id) : [...chips, id],
    );
  };

  const handleOnly = (id: string) => {
    setChips([id]);
  };

  // Position
  useLayoutEffect(() => {
    setPos(computePosition(triggerRef, 280));
  }, [triggerRef]);

  // Reposition on resize/scroll
  useEffect(() => {
    const reposition = () => setPos(computePosition(triggerRef, 280));
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [triggerRef]);

  // Outside click to close
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose, triggerRef]);

  // Escape to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto-focus search field
  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const renderRow = (t: NodeTypeConfig) => {
    const checked = chips.includes(t.id);
    return (
      <div
        key={t.id}
        className="dg-as-pop-row"
        onClick={() => toggleType(t.id)}
      >
        <Checkbox state={checked ? "on" : "off"} />
        {t.kind === "node" ? (
          <span className="dg-as-pop-dot" style={{ background: t.color }} />
        ) : (
          <span className="dg-as-pop-ring" />
        )}
        <span>{t.label}</span>
        <button
          className="dg-as-only-btn"
          onClick={(e) => {
            e.stopPropagation();
            handleOnly(t.id);
          }}
          onMouseDown={(e) => e.preventDefault()}
        >
          Only
        </button>
      </div>
    );
  };

  const popover = (
    <div
      ref={popRef}
      className="dg-as-filter-pop"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      <div className="dg-as-pop-search">
        <input
          ref={searchRef}
          className="dg-as-pop-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter types…"
        />
      </div>
      <div className="dg-as-pop-list">
        {displayTypes.length === 0 ? (
          <div className="dg-as-pop-empty">No matches</div>
        ) : (
          <>
            {/* Select all — hidden when searching */}
            {!filtered && (
              <div className="dg-as-pop-section">
                <div
                  className="dg-as-pop-row dg-as-pop-select-all"
                  onClick={handleSelectAll}
                >
                  <Checkbox state={selectAllState} />
                  <span />
                  <span className="dg-as-pop-select-all-label">Select all</span>
                  <span />
                </div>
              </div>
            )}

            {/* Node types */}
            {displayNodeTypes.length > 0 && (
              <div className="dg-as-pop-section">
                {displayNodeTypes.map(renderRow)}
              </div>
            )}

            {/* Page / Block */}
            {displayOtherTypes.length > 0 && (
              <div className="dg-as-pop-section">
                {displayOtherTypes.map(renderRow)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return ReactDOM.createPortal(popover, document.body);
};

/* ── Sort Dropdown ───────────────────────────────────────────── */

const SORT_OPTIONS: { key: SortKey; label: string; directional: boolean }[] = [
  { key: "relevance", label: "Relevance", directional: false },
  { key: "date_modified", label: "Date modified", directional: true },
  { key: "date_created", label: "Date created", directional: true },
  { key: "alphabetical", label: "Alphabetical", directional: true },
  { key: "most_connected", label: "Most connected", directional: false },
];

type SortDropdownProps = {
  sort: Sort;
  setSort: (s: Sort) => void;
  triggerRef: RefObject<HTMLElement>;
  onClose: () => void;
};

export const SortDropdown = ({
  sort,
  setSort,
  triggerRef,
  onClose,
}: SortDropdownProps) => {
  const [pos, setPos] = useState<PopoverPosition>({ top: 0, left: 0 });
  const dropRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setPos(computePosition(triggerRef, 240));
  }, [triggerRef]);

  useEffect(() => {
    const reposition = () => setPos(computePosition(triggerRef, 240));
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [triggerRef]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (dropRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose, triggerRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ArrowUp = () => (
    <svg
      width="10"
      height="12"
      viewBox="0 0 10 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 10 L5 2 M2 5 L5 2 L8 5" />
    </svg>
  );

  const ArrowDown = () => (
    <svg
      width="10"
      height="12"
      viewBox="0 0 10 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 2 L5 10 M2 7 L5 10 L8 7" />
    </svg>
  );

  const dropdown = (
    <div
      ref={dropRef}
      className="dg-as-dropdown"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
    >
      <div className="dg-as-dropdown-label">Sort by</div>
      {SORT_OPTIONS.map((opt) => {
        const isSelected = sort.key === opt.key;
        return (
          <button
            key={opt.key}
            className={`dg-as-dropdown-item${isSelected ? "selected" : ""}`}
            onClick={() => {
              setSort({ key: opt.key, dir: sort.dir });
              onClose();
            }}
          >
            <span className="dg-as-dropdown-check">
              {isSelected && (
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="2,6 5,9 10,3" />
                </svg>
              )}
            </span>
            <span className="dg-as-dropdown-item-label">{opt.label}</span>
            {opt.directional && (
              <span
                className="dg-as-dir-toggles"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className={`dg-as-dir-btn${isSelected && sort.dir === "asc" ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSort({ key: opt.key, dir: "asc" });
                  }}
                  title="Ascending"
                >
                  <ArrowUp />
                </button>
                <button
                  className={`dg-as-dir-btn${isSelected && sort.dir === "desc" ? "active" : ""}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSort({ key: opt.key, dir: "desc" });
                  }}
                  title="Descending"
                >
                  <ArrowDown />
                </button>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  return ReactDOM.createPortal(dropdown, document.body);
};

/* ── Help Popover ────────────────────────────────────────────── */

type HelpPopoverProps = {
  types: NodeTypeConfig[];
  triggerRef: RefObject<HTMLElement>;
  onClose: () => void;
};

export const HelpPopover = ({
  types,
  triggerRef,
  onClose,
}: HelpPopoverProps) => {
  const [pos, setPos] = useState<PopoverPosition>({ top: 0, left: 0 });
  const popRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setPos(computePosition(triggerRef, 320));
  }, [triggerRef]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [onClose, triggerRef]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const nodeTypes = types.filter((t) => t.kind === "node");

  const popover = (
    <div
      ref={popRef}
      className="dg-as-help-pop"
      style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <h4>Filter by type</h4>
      <div className="dg-as-help-row">
        <span>Add filter chip</span>
        <span className="dg-as-help-keys">
          <kbd>evd</kbd>
          <kbd>space</kbd>
        </span>
      </div>
      <div className="dg-as-help-row">
        <span>Autocomplete prefix</span>
        <span className="dg-as-help-keys">
          <kbd>ev</kbd>
          <kbd>tab</kbd>
        </span>
      </div>
      <div className="dg-as-help-row">
        <span>Remove last chip</span>
        <span className="dg-as-help-keys">
          <kbd>⌫</kbd>
        </span>
      </div>

      {nodeTypes.length > 0 && (
        <>
          <h4>Triggers</h4>
          <div className="dg-as-triggers-grid">
            {nodeTypes.map((t) => (
              <span key={t.id}>
                <kbd>{t.trigger}</kbd> {t.label}
              </span>
            ))}
          </div>
        </>
      )}

      <h4>Navigate</h4>
      <div className="dg-as-help-row">
        <span>Move selection</span>
        <span className="dg-as-help-keys">
          <kbd>↑</kbd>
          <kbd>↓</kbd>
        </span>
      </div>
      <div className="dg-as-help-row">
        <span>Open in sidebar</span>
        <span className="dg-as-help-keys">
          <kbd>↵</kbd>
        </span>
      </div>
      <div className="dg-as-help-row">
        <span>Open in main</span>
        <span className="dg-as-help-keys">
          <kbd>⇧↵</kbd>
        </span>
      </div>
      <div className="dg-as-help-row">
        <span>Open all results</span>
        <span className="dg-as-help-keys">
          <kbd>⌘↵</kbd>
        </span>
      </div>
      <div className="dg-as-help-row">
        <span>Close</span>
        <span className="dg-as-help-keys">
          <kbd>esc</kbd>
        </span>
      </div>
    </div>
  );

  return ReactDOM.createPortal(popover, document.body);
};
