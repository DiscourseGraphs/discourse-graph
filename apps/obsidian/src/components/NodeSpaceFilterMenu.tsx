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
import {
  handleCheckboxLabelClick,
  handleCheckboxLabelMouseDown,
} from "~/utils/checkboxLabelClick";
import {
  filterSpacesByQuery,
  hasActiveSpaceFilter,
} from "~/utils/discourseSpaceFilter";
import type { SpaceOption } from "~/utils/remoteSpaceCandidates";

const SpaceFilterRow = ({
  isChecked,
  onKeyDown,
  onToggle,
  registerRef,
  space,
}: {
  isChecked: boolean;
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
  onToggle: () => void;
  registerRef: (element: HTMLInputElement | null) => void;
  space: SpaceOption;
}): ReactElement => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    // See `NodeTypeFilterRow`'s identical comment: a single element, not a
    // padded outer div wrapping a smaller label — that padding was a dead
    // zone the click/mousedown handlers never covered.
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
      <span className="text-normal truncate text-[length:var(--font-ui-small)]">
        {space.name}
      </span>
    </label>
  );
};

const NodeSpaceFilterPanel = ({
  onSelectedIdsChange,
  selectedIds,
  spaces,
}: {
  onSelectedIdsChange: (ids: string[]) => void;
  selectedIds: string[];
  spaces: SpaceOption[];
}): ReactElement => {
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);

  const filteredSpaces = useMemo(
    () => filterSpacesByQuery(spaces, query),
    [spaces, query],
  );

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const toggleSpace = (id: string): void => {
    onSelectedIdsChange(
      selectedIdSet.has(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...selectedIds, id],
    );
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key !== "ArrowDown" || !filteredSpaces.length) return;
    event.preventDefault();
    rowRefs.current[0]?.focus();
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIndex = index + 1 < filteredSpaces.length ? index + 1 : 0;
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
          placeholder="Filter spaces…"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-full"
        />
      </div>
      <div className="max-h-64 overflow-y-auto py-[var(--size-4-1)]">
        {filteredSpaces.length === 0 ? (
          <div className="text-muted p-[var(--size-4-4)] text-center text-[length:var(--font-ui-small)]">
            No matching spaces
          </div>
        ) : (
          filteredSpaces.map((space, index) => (
            <SpaceFilterRow
              key={space.id}
              isChecked={selectedIdSet.has(space.id)}
              onKeyDown={(event) => handleRowKeyDown(event, index)}
              onToggle={() => toggleSpace(space.id)}
              registerRef={(element) => {
                rowRefs.current[index] = element;
              }}
              space={space}
            />
          ))
        )}
      </div>
    </>
  );
};

export const NodeSpaceFilterMenu = ({
  app,
  isOpen,
  onOpenChange,
  onSelectedSpaceIdsChange,
  selectedSpaceIds,
  spaces,
}: {
  app: App;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSelectedSpaceIdsChange: (ids: string[]) => void;
  selectedSpaceIds: string[];
  spaces: SpaceOption[];
}): ReactElement => {
  const isFilterActive = hasActiveSpaceFilter(selectedSpaceIds);
  const activeFilterCount = selectedSpaceIds.length;

  return (
    <SearchDropdown
      app={app}
      ariaLabel={
        activeFilterCount > 0
          ? `Filter by space, ${activeFilterCount} selected`
          : "Filter by space"
      }
      iconName="globe"
      isActive={isFilterActive}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      panelClassName="w-64"
      title="Filter by space"
    >
      <NodeSpaceFilterPanel
        onSelectedIdsChange={onSelectedSpaceIdsChange}
        selectedIds={selectedSpaceIds}
        spaces={spaces}
      />
    </SearchDropdown>
  );
};
