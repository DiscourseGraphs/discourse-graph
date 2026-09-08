import { App } from "obsidian";
import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { SearchDropdown } from "~/components/SearchDropdown";
import { DiscourseNode } from "~/types";
import { getAllDiscourseNodeColors } from "~/utils/colorUtils";
import {
  NODE_TYPE_FILTER_SEARCH_THRESHOLD,
  filterNodeTypesByQuery,
  fromPanelSelectedIds,
  hasActiveTypeFilter,
  toPanelSelectedIds,
} from "~/utils/discourseNodeTypeFilter";

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
    <>
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
    </>
  );
};

export const NodeTypeFilterMenu = ({
  app,
  isOpen,
  nodeTypes,
  onOpenChange,
  onSelectedNodeTypeIdsChange,
  selectedNodeTypeIds,
}: {
  app: App;
  isOpen: boolean;
  nodeTypes: DiscourseNode[];
  onOpenChange: (isOpen: boolean) => void;
  onSelectedNodeTypeIdsChange: (ids: string[]) => void;
  selectedNodeTypeIds: string[];
}): ReactElement => {
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

  const activeFilterCount = isFilterActive ? selectedNodeTypeIds.length : 0;

  return (
    <SearchDropdown
      app={app}
      ariaLabel={
        activeFilterCount > 0
          ? `Filter by type, ${activeFilterCount} selected`
          : "Filter by type"
      }
      badgeCount={activeFilterCount}
      iconName="filter"
      isActive={isFilterActive}
      isDisabled={nodeTypes.length === 0}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      panelClassName="w-64"
      title={
        nodeTypes.length === 0
          ? "No discourse node types configured"
          : "Filter by type"
      }
    >
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
    </SearchDropdown>
  );
};
