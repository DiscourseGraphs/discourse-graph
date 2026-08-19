import { setIcon } from "obsidian";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { DiscourseNode } from "~/types";
import { getAllDiscourseNodeColors } from "~/utils/colorUtils";
import {
  NODE_TYPE_FILTER_SEARCH_THRESHOLD,
  filterNodeTypesByQuery,
  fromPanelSelectedIds,
  hasActiveTypeFilter,
  toPanelSelectedIds,
} from "~/utils/discourseNodeTypeFilter";

const FilterIcon = ({ name }: { name: string }): ReactElement => (
  // Emptied first because React reuses the node across renders and `setIcon`
  // appends rather than replaces.
  <span
    className="flex items-center"
    ref={(el) => {
      if (!el) return;
      el.empty();
      setIcon(el, name);
    }}
  />
);

const NodeTypeFilterRow = ({
  color,
  isChecked,
  nodeType,
  onSelectOnly,
  onToggle,
}: {
  color: string | undefined;
  isChecked: boolean;
  nodeType: DiscourseNode;
  onSelectOnly: () => void;
  onToggle: () => void;
}): ReactElement => (
  <div className="hover:bg-modifier-hover group flex items-center gap-2 px-3 py-1.5">
    <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        className="shrink-0"
      />
      {color && (
        <span
          style={{ backgroundColor: color }}
          className="h-3 w-3 shrink-0 rounded-full"
        />
      )}
      <span className="text-normal truncate text-sm">{nodeType.name}</span>
    </label>
    <button
      type="button"
      // Hidden until the row is hovered or focused so the list stays scannable,
      // but focusable by keyboard rather than pointer-only.
      className="text-muted hover:text-normal shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      onClick={(event) => {
        event.stopPropagation();
        onSelectOnly();
      }}
      onMouseDown={(event) => event.preventDefault()}
    >
      Only
    </button>
  </div>
);

const NodeTypeFilterPanel = ({
  isFilterActive,
  nodeTypes,
  onSelectedIdsChange,
  selectedIds,
}: {
  isFilterActive: boolean;
  nodeTypes: DiscourseNode[];
  onSelectedIdsChange: (ids: string[]) => void;
  selectedIds: string[];
}): ReactElement => {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);

  const showTypeSearch = nodeTypes.length > NODE_TYPE_FILTER_SEARCH_THRESHOLD;

  const colorsById = useMemo(() => {
    const byId = new Map<string, string>();
    getAllDiscourseNodeColors(nodeTypes).forEach(({ nodeType, colors }) => {
      byId.set(nodeType.id, colors.backgroundColor);
    });
    return byId;
  }, [nodeTypes]);

  const filteredNodeTypes = useMemo(
    () => filterNodeTypesByQuery(nodeTypes, query),
    [nodeTypes, query],
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    if (showTypeSearch) searchRef.current?.focus();
  }, [showTypeSearch]);

  const toggleType = (id: string): void => {
    onSelectedIdsChange(
      selectedIdSet.has(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  };

  return (
    <div className="border-modifier-border absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-md border bg-primary shadow-[0_4px_12px_rgba(0,0,0,0.15)]">
      {/* Clearing is the only thing this control ever does, so it says so and
          appears only when there is a filter to clear. A "select all" checkbox
          would sit checked-and-inert whenever no filter is active, since an empty
          selection and a full one are the same state. */}
      {isFilterActive && (
        <div className="border-modifier-border border-b p-2">
          <button
            type="button"
            onClick={() => onSelectedIdsChange([])}
            onMouseDown={(event) => event.preventDefault()}
            className="w-full text-sm"
          >
            {`Clear filter (${selectedIds.length})`}
          </button>
        </div>
      )}
      {showTypeSearch && (
        <div className="border-modifier-border border-b p-2">
          <input
            ref={searchRef}
            type="text"
            value={query}
            placeholder="Filter types…"
            onChange={(event) => setQuery(event.target.value)}
            className="w-full"
          />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto py-1">
        {filteredNodeTypes.length === 0 ? (
          <div className="text-muted p-4 text-center text-sm">
            No matching node types
          </div>
        ) : (
          filteredNodeTypes.map((nodeType) => (
            <NodeTypeFilterRow
              key={nodeType.id}
              color={colorsById.get(nodeType.id)}
              isChecked={selectedIdSet.has(nodeType.id)}
              nodeType={nodeType}
              onSelectOnly={() => onSelectedIdsChange([nodeType.id])}
              onToggle={() => toggleType(nodeType.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export const NodeTypeFilterMenu = ({
  isOpen,
  nodeTypes,
  onOpenChange,
  onSelectedNodeTypeIdsChange,
  selectedNodeTypeIds,
}: {
  isOpen: boolean;
  nodeTypes: DiscourseNode[];
  onOpenChange: (isOpen: boolean) => void;
  onSelectedNodeTypeIdsChange: (ids: string[]) => void;
  selectedNodeTypeIds: string[];
}): ReactElement => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const allTypeIds = useMemo(
    () => nodeTypes.map((nodeType) => nodeType.id),
    [nodeTypes],
  );

  const isFilterActive = hasActiveTypeFilter({
    selectedTypeIds: selectedNodeTypeIds,
    allTypeIds,
  });

  const panelSelectedIds = useMemo(
    () =>
      toPanelSelectedIds({ selectedTypeIds: selectedNodeTypeIds, allTypeIds }),
    [allTypeIds, selectedNodeTypeIds],
  );

  // `activeDocument` rather than `document`, so the listener lands in whichever
  // window holds the modal when Obsidian is running a popout.
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return;
      onOpenChange(false);
    };
    activeDocument.addEventListener("mousedown", handlePointerDown, true);
    return () =>
      activeDocument.removeEventListener("mousedown", handlePointerDown, true);
  }, [isOpen, onOpenChange]);

  const activeFilterCount = isFilterActive ? selectedNodeTypeIds.length : 0;

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onKeyDown={(event) => {
        if (!isOpen) return;
        // Every keystroke stops here while the panel is open. The modal's handler
        // is an ancestor and reads Enter as "open the highlighted result" and the
        // arrows as "move the selection", so typing in the type search would
        // otherwise open a note and close the whole modal.
        event.stopPropagation();
        if (event.key !== "Escape") return;
        // Obsidian's Modal closes on Escape from its own keymap scope, which sits
        // outside React, so the native event has to stop too or the modal goes
        // with the panel.
        event.preventDefault();
        event.nativeEvent.stopImmediatePropagation();
        onOpenChange(false);
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-label={
          activeFilterCount > 0
            ? `Filter by type, ${activeFilterCount} selected`
            : "Filter by type"
        }
        disabled={nodeTypes.length === 0}
        title={
          nodeTypes.length === 0
            ? "No discourse node types configured"
            : "Filter by type"
        }
        onClick={() => onOpenChange(!isOpen)}
        // Keeps focus in the search input, so arrow and Enter navigation stays
        // live while the panel is open.
        onMouseDown={(event) => event.preventDefault()}
        className={`clickable-icon relative ${
          isOpen || isFilterActive ? "is-active" : ""
        }`}
      >
        <FilterIcon name="filter" />
        {activeFilterCount > 0 && (
          <span
            aria-hidden
            className="bg-accent pointer-events-none absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-lg px-1 text-xs font-semibold leading-none text-white"
          >
            {activeFilterCount}
          </span>
        )}
      </button>
      {isOpen && (
        <NodeTypeFilterPanel
          isFilterActive={isFilterActive}
          nodeTypes={nodeTypes}
          onSelectedIdsChange={(panelIds) =>
            onSelectedNodeTypeIdsChange(
              fromPanelSelectedIds({ panelSelectedIds: panelIds, allTypeIds }),
            )
          }
          selectedIds={panelSelectedIds}
        />
      )}
    </div>
  );
};
