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

const DIRECTIONS: { direction: SortDirection; label: string }[] = [
  { direction: "asc", label: "Asc" },
  { direction: "desc", label: "Desc" },
];

const getDirectionIconName = (direction: SortDirection): string =>
  direction === "asc" ? "arrow-up-narrow-wide" : "arrow-down-wide-narrow";

/** Rows are divs, not buttons: Obsidian's button chrome reads as separate widgets rather than a menu. */
const SortOptionRow = ({
  isSelected,
  label,
  onSelect,
}: {
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}): ReactElement => (
  <div
    role="menuitemradio"
    aria-checked={isSelected}
    onClick={onSelect}
    // Keeps focus in the search input, so the result list stays keyboard-driven.
    onMouseDown={(event) => event.preventDefault()}
    className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm ${
      isSelected
        ? "bg-accent text-on-accent"
        : "text-normal hover:bg-modifier-hover"
    }`}
  >
    {/* Always occupies its slot, so selecting an option does not shift the labels. */}
    <span className="flex w-4 shrink-0 justify-center">
      {isSelected && <ObsidianIcon name="check" />}
    </span>
    <span className="truncate">{label}</span>
  </div>
);

const DirectionToggle = ({
  onSelect,
  sortDirection,
  sortKey,
}: {
  onSelect: (direction: SortDirection) => void;
  sortDirection: SortDirection;
  sortKey: SortKey;
}): ReactElement => (
  <div className="border-modifier-border flex gap-1 border-t p-2">
    {DIRECTIONS.map(({ direction, label }) => (
      <div
        key={direction}
        role="button"
        aria-pressed={direction === sortDirection}
        // A direction's wording depends on the dimension, so the full phrase is the title.
        title={getSortDirectionLabel({ sortKey, direction })}
        onClick={() => onSelect(direction)}
        onMouseDown={(event) => event.preventDefault()}
        className={`flex flex-1 cursor-pointer items-center justify-center gap-1 rounded px-2 py-1 text-sm ${
          direction === sortDirection
            ? "bg-accent text-on-accent"
            : "text-normal hover:bg-modifier-hover"
        }`}
      >
        <ObsidianIcon name={getDirectionIconName(direction)} />
        {label}
      </div>
    ))}
  </div>
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

  return (
    <SearchDropdown
      app={app}
      ariaLabel={`Sort by ${getSortOptionLabel(sortKey)}, ${directionLabel}`}
      iconName={getDirectionIconName(sortDirection)}
      isActive={!isDefaultSort({ sortKey, direction: sortDirection })}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      panelClassName="w-56"
      title={`Sort by ${getSortOptionLabel(sortKey)} — ${directionLabel}`}
    >
      <div role="group" className="pb-1">
        <div className="text-muted px-3 pb-1 pt-2 text-xs">Sort by</div>
        {SORT_OPTIONS.map((option) => (
          <SortOptionRow
            key={option.key}
            isSelected={option.key === sortKey}
            label={option.label}
            onSelect={() =>
              onSortChange({
                sortKey: option.key,
                // Switching dimension uses that dimension's default; re-picking keeps the direction.
                direction:
                  option.key === sortKey
                    ? sortDirection
                    : getDefaultDirectionForKey(option.key),
              })
            }
          />
        ))}
      </div>
      <DirectionToggle
        onSelect={(direction) => onSortChange({ sortKey, direction })}
        sortDirection={sortDirection}
        sortKey={sortKey}
      />
    </SearchDropdown>
  );
};
