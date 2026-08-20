import { App } from "obsidian";
import type { ReactElement } from "react";
import { ObsidianIcon } from "~/components/ObsidianIcon";
import { SearchDropdown } from "~/components/SearchDropdown";
import {
  SORT_OPTIONS,
  getDefaultDirectionForKey,
  getSortDirectionLabel,
  getSortOptionLabel,
  isDefaultSort,
  type SortDirection,
  type SortKey,
} from "~/utils/discourseNodeSort";

const getDirectionIconName = (direction: SortDirection): string =>
  direction === "asc" ? "arrow-up-narrow-wide" : "arrow-down-wide-narrow";

const SortOptionRow = ({
  isSelected,
  label,
  onSelect,
}: {
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}): ReactElement => (
  <button
    type="button"
    role="menuitemradio"
    aria-checked={isSelected}
    onClick={onSelect}
    // Keeps focus in the search input, so the result list stays keyboard-driven
    // while the panel is open.
    onMouseDown={(event) => event.preventDefault()}
    className="hover:bg-modifier-hover flex w-full items-center gap-2 bg-transparent px-3 py-1.5 text-left shadow-none"
  >
    {/* Always occupies its slot, so selecting an option does not shift the labels. */}
    <span className="flex w-4 shrink-0 justify-center">
      {isSelected && <ObsidianIcon name="check" />}
    </span>
    <span className="text-normal truncate text-sm">{label}</span>
  </button>
);

export const NodeSortMenu = ({
  app,
  isOpen,
  onOpenChange,
  onSortChange,
  sortDirection,
  sortKey,
}: {
  app: App;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSortChange: (next: { sortKey: SortKey; direction: SortDirection }) => void;
  sortDirection: SortDirection;
  sortKey: SortKey;
}): ReactElement => {
  const directionLabel = getSortDirectionLabel({
    sortKey,
    direction: sortDirection,
  });

  const toggleDirection = (): void =>
    onSortChange({
      sortKey,
      direction: sortDirection === "asc" ? "desc" : "asc",
    });

  // Re-picking the active dimension flips it, which is the gesture most sortable
  // tables use; picking a different one starts from that dimension's default.
  const selectSortKey = (nextKey: SortKey): void => {
    if (nextKey === sortKey) {
      toggleDirection();
      return;
    }
    onSortChange({
      sortKey: nextKey,
      direction: getDefaultDirectionForKey(nextKey),
    });
  };

  return (
    <SearchDropdown
      app={app}
      ariaLabel={`Sort by ${getSortOptionLabel(sortKey)}, ${directionLabel}`}
      iconName={getDirectionIconName(sortDirection)}
      isActive={!isDefaultSort({ sortKey, direction: sortDirection })}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      panelClassName="w-56"
      title="Sort results"
      triggerLabel={getSortOptionLabel(sortKey)}
    >
      <div role="group" className="py-1">
        {SORT_OPTIONS.map((option) => (
          <SortOptionRow
            key={option.key}
            isSelected={option.key === sortKey}
            label={option.label}
            onSelect={() => selectSortKey(option.key)}
          />
        ))}
      </div>
      <div className="border-modifier-border border-t p-2">
        <button
          type="button"
          onClick={toggleDirection}
          onMouseDown={(event) => event.preventDefault()}
          className="flex w-full items-center justify-center gap-2 text-sm"
        >
          <ObsidianIcon name={getDirectionIconName(sortDirection)} />
          {directionLabel}
        </button>
      </div>
    </SearchDropdown>
  );
};
