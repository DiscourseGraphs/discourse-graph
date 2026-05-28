import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Button,
  Checkbox,
  InputGroup,
  Popover,
  Position,
} from "@blueprintjs/core";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { type DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  NODE_TYPE_FILTER_SEARCH_THRESHOLD,
  filterDiscourseNodesByQuery,
  fromPopoverSelectedIds,
  getSelectAllCheckState,
  hasActiveTypeFilter,
  toPopoverSelectedIds,
} from "~/utils/discourseNodeTypeFilter";

export type DiscourseNodeTypeFilterProps = {
  nodeTypes: DiscourseNode[];
  selectedTypeIds: string[];
  onSelectedTypeIdsChange: (ids: string[]) => void;
  onPopoverOpenChange?: (isOpen: boolean) => void;
};

const getNodeIndicatorColor = (node: DiscourseNode): string =>
  formatHexColor(node.canvasSettings?.color) || "#000";

const NodeTypeFilterRow = ({
  isChecked,
  node,
  onSelectOnly,
  onToggle,
}: {
  isChecked: boolean;
  node: DiscourseNode;
  onSelectOnly: () => void;
  onToggle: () => void;
}): React.ReactElement => (
  <div className="group flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50">
    <Checkbox
      checked={isChecked}
      className="mb-0 flex-1 text-sm font-normal text-gray-900"
      labelElement={
        <span className="inline-flex items-center gap-2 font-normal">
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: getNodeIndicatorColor(node) }}
          />
          <span className="font-normal">{node.text}</span>
        </span>
      }
      onChange={onToggle}
    />
    <Button
      className="opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
      minimal
      style={{ padding: "4px 8px" }}
      onClick={(event) => {
        event.stopPropagation();
        onSelectOnly();
      }}
      onMouseDown={(event) => event.preventDefault()}
      small
      text="Only"
    />
  </div>
);

const FilterPopoverPanel = ({
  isOpen,
  nodeTypes,
  onSelectedIdsChange,
  selectedIds,
}: {
  isOpen: boolean;
  nodeTypes: DiscourseNode[];
  onSelectedIdsChange: (ids: string[]) => void;
  selectedIds: string[];
}): React.ReactElement => {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  const showTypeSearch = nodeTypes.length > NODE_TYPE_FILTER_SEARCH_THRESHOLD;

  const filteredNodes = useMemo(
    () => filterDiscourseNodesByQuery(nodeTypes, query),
    [nodeTypes, query],
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectAllState = getSelectAllCheckState({
    selectedIds,
    totalCount: nodeTypes.length,
  });

  const handleSelectAll = useCallback((): void => {
    if (selectAllState === "off") {
      onSelectedIdsChange(nodeTypes.map((node) => node.type));
      return;
    }
    onSelectedIdsChange([]);
  }, [nodeTypes, onSelectedIdsChange, selectAllState]);

  const toggleType = useCallback(
    (id: string): void => {
      const nextSelectedIds = selectedIdSet.has(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id];
      onSelectedIdsChange(nextSelectedIds);
    },
    [onSelectedIdsChange, selectedIdSet, selectedIds],
  );

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      return;
    }
    if (!showTypeSearch) return;
    searchRef.current?.focus();
  }, [isOpen, showTypeSearch]);

  const hasTypeSearchQuery = query.trim().length > 0;

  return (
    <div className="w-64 overflow-hidden rounded-lg bg-white p-0">
      {showTypeSearch && (
        <div className="p-2">
          <InputGroup
            inputRef={searchRef}
            leftIcon="search"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              setQuery(event.target.value)
            }
            placeholder="Filter types…"
            small
            value={query}
          />
        </div>
      )}
      <div className="max-h-64 overflow-y-auto p-2">
        {filteredNodes.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No matching node types
          </div>
        ) : (
          <>
            {!hasTypeSearchQuery && (
              <div className="border-b border-gray-200 px-3 py-1.5 hover:bg-gray-50">
                <Checkbox
                  checked={selectAllState !== "off"}
                  className="mb-0 text-sm text-gray-900"
                  indeterminate={selectAllState === "indeterminate"}
                  labelElement={
                    <span className="font-semibold">Select all</span>
                  }
                  onChange={handleSelectAll}
                />
              </div>
            )}
            <div className="pt-1">
              {filteredNodes.map((node) => (
                <NodeTypeFilterRow
                  isChecked={selectedIdSet.has(node.type)}
                  key={node.type}
                  node={node}
                  onSelectOnly={() => onSelectedIdsChange([node.type])}
                  onToggle={() => toggleType(node.type)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export const DiscourseNodeTypeFilter = ({
  nodeTypes,
  onPopoverOpenChange,
  onSelectedTypeIdsChange,
  selectedTypeIds,
}: DiscourseNodeTypeFilterProps): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLElement | null>(null);

  const allTypeIds = useMemo(
    () => nodeTypes.map((node) => node.type),
    [nodeTypes],
  );
  const isFilterActive = hasActiveTypeFilter({
    selectedTypeIds,
    allTypeIds,
  });
  const isFilterReady = nodeTypes.length > 0;

  const popoverSelectedIds = useMemo(
    () =>
      toPopoverSelectedIds({
        selectedTypeIds,
        allTypeIds,
      }),
    [allTypeIds, selectedTypeIds],
  );

  const activeFilterCount = isFilterActive ? selectedTypeIds.length : 0;

  const setPopoverOpen = useCallback(
    (nextOpen: boolean): void => {
      setIsOpen(nextOpen);
      onPopoverOpenChange?.(nextOpen);
    },
    [onPopoverOpenChange],
  );

  const handlePopoverInteraction = useCallback(
    (nextOpen: boolean, event?: React.SyntheticEvent<HTMLElement>): void => {
      if (!isFilterReady) return;
      if (nextOpen) {
        event?.stopPropagation();
      }
      setPopoverOpen(nextOpen);
    },
    [isFilterReady, setPopoverOpen],
  );

  const handlePopoverSelectedIdsChange = useCallback(
    (nextPopoverSelectedIds: string[]): void => {
      onSelectedTypeIdsChange(
        fromPopoverSelectedIds({
          popoverSelectedIds: nextPopoverSelectedIds,
          allTypeIds,
        }),
      );
    },
    [allTypeIds, onSelectedTypeIdsChange],
  );

  const isTriggerActive = isOpen || isFilterActive;

  const filterButton = (
    <span className="relative inline-flex shrink-0 items-center">
      <Button
        aria-expanded={isOpen}
        aria-label={
          activeFilterCount > 0
            ? `Filter by type, ${activeFilterCount} selected`
            : "Filter by type"
        }
        className={
          isTriggerActive
            ? "!bg-[rgba(95,87,192,0.1)] !text-[#5f57c0]"
            : "!text-gray-600 hover:!bg-gray-100 hover:!text-gray-900"
        }
        disabled={!isFilterReady}
        elementRef={triggerRef}
        icon="filter"
        minimal
        onMouseDown={(event) => event.preventDefault()}
        title={
          isFilterReady ? "Filter by type" : "Loading discourse node types..."
        }
      />
      <span
        aria-hidden={activeFilterCount === 0}
        className="pointer-events-none absolute inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-lg bg-blue-600 px-1 text-xs font-semibold leading-none text-white"
        style={{
          right: 0,
          top: 0,
          transform: "translate(25%, -25%)",
          visibility: activeFilterCount > 0 ? "visible" : "hidden",
        }}
      >
        {activeFilterCount > 0 ? activeFilterCount : 0}
      </span>
    </span>
  );

  return (
    <span className="inline-flex shrink-0 items-center [&_.bp3-popover-wrapper]:shrink-0">
      <Popover
        autoFocus={false}
        canEscapeKeyClose
        content={
          <FilterPopoverPanel
            isOpen={isOpen}
            nodeTypes={nodeTypes}
            onSelectedIdsChange={handlePopoverSelectedIdsChange}
            selectedIds={popoverSelectedIds}
          />
        }
        enforceFocus={false}
        isOpen={isOpen}
        minimal
        modifiers={{
          flip: { enabled: true },
          preventOverflow: {
            enabled: true,
            boundariesElement: "viewport",
          },
        }}
        onClose={() => setPopoverOpen(false)}
        onInteraction={handlePopoverInteraction}
        popoverClassName="p-0 overflow-hidden"
        popoverRef={popoverRef}
        position={Position.BOTTOM_RIGHT}
        target={filterButton}
        usePortal
      />
    </span>
  );
};
