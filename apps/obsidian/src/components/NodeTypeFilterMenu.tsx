import { App } from "obsidian";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import { SearchDropdown } from "~/components/SearchDropdown";
import { DiscourseNode } from "~/types";
import {
  handleCheckboxLabelClick,
  handleCheckboxLabelMouseDown,
} from "~/utils/checkboxLabelClick";
import { getAllDiscourseNodeColors } from "~/utils/colorUtils";
import {
  filterNodeTypesByQuery,
  hasActiveTypeFilter,
} from "~/utils/discourseNodeTypeFilter";

const NodeTypeFilterRow = ({
  color,
  isChecked,
  nodeType,
  onKeyDown,
  onToggle,
  registerRef,
}: {
  color: string | undefined;
  isChecked: boolean;
  nodeType: DiscourseNode;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onToggle: () => void;
  registerRef: (element: HTMLInputElement | null) => void;
}): ReactElement => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    // A single element, not a padded outer div wrapping a smaller label: the
    // click/mousedown handlers only live on the label, so a wrapping div's
    // own padding was a dead zone — visually part of the row (covered by its
    // hover highlight) but outside the label's hit area, so a click there
    // hit neither handler, and (per `handleCheckboxLabelMouseDown`'s own
    // comment) still triggered the focus-drops-to-body panel-close bug.
    <label
      className="hover:bg-modifier-hover flex min-w-0 cursor-pointer items-center gap-[var(--size-4-2)] px-[var(--size-4-3)] py-[var(--size-2-3)]"
      onMouseDown={(event) =>
        handleCheckboxLabelMouseDown({ event, inputElement: inputRef.current })
      }
      onClick={(event) =>
        handleCheckboxLabelClick({ event, inputElement: inputRef.current, onToggle })
      }
    >
      <input
        ref={(element) => {
          inputRef.current = element;
          registerRef(element);
        }}
        type="checkbox"
        checked={isChecked}
        onChange={onToggle}
        onKeyDown={onKeyDown}
        className="shrink-0"
      />
      {color && (
        <span
          style={{ backgroundColor: color }}
          className="h-[var(--size-4-3)] w-[var(--size-4-3)] shrink-0 rounded-full"
        />
      )}
      <span className="text-normal truncate text-[length:var(--font-ui-small)]">
        {nodeType.name}
      </span>
    </label>
  );
};

const NodeTypeFilterPanel = ({
  nodeTypes,
  onSelectedIdsChange,
  selectedIds,
}: {
  nodeTypes: DiscourseNode[];
  onSelectedIdsChange: (ids: string[]) => void;
  selectedIds: string[];
}): ReactElement => {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);

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
    searchRef.current?.focus();
  }, []);

  const toggleType = (id: string): void => {
    onSelectedIdsChange(
      selectedIdSet.has(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "ArrowDown" || !filteredNodeTypes.length) return;
    event.preventDefault();
    rowRefs.current[0]?.focus();
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      // Wraps to the first row, mirroring ArrowUp's escape to the search box at index 0.
      const nextIndex = index + 1 < filteredNodeTypes.length ? index + 1 : 0;
      rowRefs.current[nextIndex]?.focus();
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      if (index === 0) {
        searchRef.current?.focus();
        return;
      }
      rowRefs.current[index - 1]?.focus();
    }
  };

  return (
    <>
      <div className="border-modifier-border border-b p-[var(--size-4-2)]">
        <input
          ref={searchRef}
          type="text"
          value={query}
          placeholder="Filter types…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-full"
        />
      </div>
      <div className="max-h-64 overflow-y-auto py-[var(--size-4-1)]">
        {filteredNodeTypes.length === 0 ? (
          <div className="text-muted p-[var(--size-4-4)] text-center text-[length:var(--font-ui-small)]">
            No matching node types
          </div>
        ) : (
          filteredNodeTypes.map((nodeType, index) => (
            <NodeTypeFilterRow
              key={nodeType.id}
              color={colorsById.get(nodeType.id)}
              isChecked={selectedIdSet.has(nodeType.id)}
              nodeType={nodeType}
              onKeyDown={(event) => handleRowKeyDown(event, index)}
              onToggle={() => toggleType(nodeType.id)}
              registerRef={(element) => {
                rowRefs.current[index] = element;
              }}
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
  const isFilterActive = hasActiveTypeFilter(selectedNodeTypeIds);

  const activeFilterCount = selectedNodeTypeIds.length;

  return (
    <SearchDropdown
      app={app}
      ariaLabel={
        activeFilterCount > 0
          ? `Filter by type, ${activeFilterCount} selected`
          : "Filter by type"
      }
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
        nodeTypes={nodeTypes}
        onSelectedIdsChange={onSelectedNodeTypeIdsChange}
        selectedIds={selectedNodeTypeIds}
      />
    </SearchDropdown>
  );
};
