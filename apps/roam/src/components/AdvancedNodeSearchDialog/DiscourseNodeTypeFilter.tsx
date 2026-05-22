import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Button, Icon, InputGroup, Popover, Position } from "@blueprintjs/core";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { type DiscourseNode } from "~/utils/getDiscourseNodes";
import {
  NODE_TYPE_FILTER_SEARCH_THRESHOLD,
  filterDiscourseNodesByQuery,
  fromPopoverSelectedIds,
  getSelectAllCheckState,
  hasActiveTypeFilter,
  toPopoverSelectedIds,
  type SelectAllCheckState,
} from "~/utils/discourseNodeTypeFilter";

export type DiscourseNodeTypeFilterProps = {
  nodeTypes: DiscourseNode[];
  selectedTypeIds: string[];
  onSelectedTypeIdsChange: (ids: string[]) => void;
  onPopoverOpenChange?: (isOpen: boolean) => void;
};

const getNodeIndicatorColor = (node: DiscourseNode): string =>
  formatHexColor(node.canvasSettings?.color) || "#000";

const FilterCheckbox = ({
  state,
}: {
  state: SelectAllCheckState;
}): React.ReactElement => (
  <span
    className={`inline-flex h-4 w-4 items-center justify-center rounded border border-solid border-gray-300 bg-white ${state === "off" ? "" : "border-blue-600 bg-blue-600"}`}
  >
    {state === "on" && <Icon icon="small-tick" size={10} color="#fff" />}
    {state === "indeterminate" && (
      <span className="h-0.5 w-2 rounded bg-white" />
    )}
  </span>
);

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
  <div
    className="group grid cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-900 hover:bg-gray-900/[0.04]"
    style={{ gridTemplateColumns: "22px 14px 1fr auto" }}
    onClick={onToggle}
    onKeyDown={(event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onToggle();
      }
    }}
    role="button"
    tabIndex={0}
  >
    <FilterCheckbox state={isChecked ? "on" : "off"} />
    <span
      className="h-3 w-3 rounded-full"
      style={{ backgroundColor: getNodeIndicatorColor(node) }}
    />
    <span>{node.text}</span>
    <Button
      className="!px-2 !py-1 opacity-0 transition-opacity group-hover:opacity-100"
      minimal
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

  const handleOnly = useCallback(
    (id: string): void => {
      onSelectedIdsChange([id]);
    },
    [onSelectedIdsChange],
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
              <div
                className="grid cursor-pointer items-center gap-2 border-b border-gray-900/10 px-3 text-sm text-gray-900 hover:bg-gray-900/[0.04]"
                style={{ gridTemplateColumns: "22px 14px 1fr auto" }}
                onClick={handleSelectAll}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleSelectAll();
                  }
                }}
                role="button"
                tabIndex={0}
              >
                <FilterCheckbox state={selectAllState} />
                <span />
                <span className="font-semibold">Select all</span>
                <span />
              </div>
            )}
            <div className="pt-1">
              {filteredNodes.map((node) => (
                <NodeTypeFilterRow
                  isChecked={selectedIdSet.has(node.type)}
                  key={node.type}
                  node={node}
                  onSelectOnly={() => handleOnly(node.type)}
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

  const closePopover = useCallback((): void => {
    setPopoverOpen(false);
  }, [setPopoverOpen]);

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

  const triggerStyle: CSSProperties = {
    position: "relative",
    minWidth: 30,
    minHeight: 30,
    padding: 0,
    color: isTriggerActive ? "#5f57c0" : "rgba(31, 31, 31, 0.6)",
    background: isTriggerActive ? "rgba(95, 87, 192, 0.1)" : "transparent",
  };

  const countPillStyle: CSSProperties = {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 14,
    height: 14,
    padding: "0 3px",
    borderRadius: 7,
    background: "#5f57c0",
    color: "#fff",
    fontSize: 9,
    fontWeight: 600,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
  };

  const filterButton = (
    <Button
      aria-expanded={isOpen}
      aria-label="Filter by type"
      disabled={!isFilterReady}
      elementRef={triggerRef}
      icon="filter"
      minimal
      onMouseDown={(event) => event.preventDefault()}
      style={triggerStyle}
      title={
        isFilterReady ? "Filter by type" : "Loading discourse node types..."
      }
    >
      {activeFilterCount > 0 && (
        <span style={countPillStyle}>{activeFilterCount}</span>
      )}
    </Button>
  );

  if (!isFilterReady) {
    return <span className="inline-flex shrink-0">{filterButton}</span>;
  }

  return (
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
      onClose={closePopover}
      onInteraction={handlePopoverInteraction}
      popoverClassName="p-0 overflow-hidden"
      popoverRef={popoverRef}
      position={Position.BOTTOM_RIGHT}
      target={filterButton}
      usePortal
    />
  );
};
