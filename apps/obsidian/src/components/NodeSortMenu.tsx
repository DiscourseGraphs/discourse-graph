import { App, setIcon } from "obsidian";
import { useEffect, useRef, type KeyboardEvent, type ReactElement } from "react";
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

// Rows are divs, so Enter and Space have to be wired up the way a button gets them free.
const activateOnKey = (
  event: KeyboardEvent<HTMLDivElement>,
  activate: () => void,
): void => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
};

const getDirectionIconName = (direction: SortDirection): string =>
  direction === "asc" ? "arrow-up-narrow-wide" : "arrow-down-wide-narrow";

/**
 * `:focus-visible`, not `:focus` — these rows are focused programmatically on
 * mouse click too (see `SortOptionRow`'s own comment on why that particular
 * click doesn't actually focus), but the general rule across this menu family
 * is a ring only for keyboard navigation. Inset (`-2px`, via Tailwind's
 * negative outline-offset) so it isn't clipped by the panel's `overflow-hidden`
 * on a row flush against its edge.
 */
const FOCUS_VISIBLE_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[color:var(--background-modifier-border-focus)]";

/** Rows are divs, not buttons: Obsidian's button chrome reads as separate widgets rather than a menu. */
const SortOptionRow = ({
  isSelected,
  label,
  onKeyDown,
  onSelect,
  registerRef,
}: {
  isSelected: boolean;
  label: string;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  registerRef: (element: HTMLDivElement | null) => void;
}): ReactElement => (
    <div
      ref={registerRef}
      role="menuitemradio"
      aria-checked={isSelected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        activateOnKey(event, onSelect);
        onKeyDown(event);
      }}
      onMouseDown={(event) => event.preventDefault()}
      className={`flex cursor-pointer items-center gap-[var(--size-4-2)] px-[var(--size-4-3)] py-[var(--size-2-3)] text-[length:var(--font-ui-small)] ${FOCUS_VISIBLE_RING} ${
        isSelected
          ? "bg-accent text-on-accent"
          : "text-normal hover:bg-modifier-hover"
      }`}
    >
      {/* Always occupies its slot, so selecting an option does not shift the labels. */}
      <span className="flex w-[var(--size-4-4)] shrink-0 justify-center">
        {isSelected && (
          <span ref={(el) => (el && setIcon(el, "check")) || undefined} />
        )}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );

/** Its own component (not inlined in the `.map` below) — kept separate from `SortOptionRow` even though neither needs local state anymore, since each still needs its own `registerRef`/`onKeyDown` wiring. */
const DirectionButton = ({
  direction,
  isSelected,
  label,
  onKeyDown,
  onSelect,
  registerRef,
  title,
}: {
  direction: SortDirection;
  isSelected: boolean;
  label: string;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  onSelect: () => void;
  registerRef: (element: HTMLDivElement | null) => void;
  title: string;
}): ReactElement => (
    <div
      ref={registerRef}
      role="button"
      aria-pressed={isSelected}
      tabIndex={0}
      title={title}
      onClick={onSelect}
      onKeyDown={(event) => {
        activateOnKey(event, onSelect);
        onKeyDown(event);
      }}
      onMouseDown={(event) => event.preventDefault()}
      className={`flex flex-1 cursor-pointer items-center justify-center gap-[var(--size-4-1)] rounded-[var(--radius-s)] px-[var(--size-4-2)] py-[var(--size-4-1)] text-[length:var(--font-ui-small)] ${FOCUS_VISIBLE_RING} ${
        isSelected
          ? "bg-accent text-on-accent"
          : "text-normal hover:bg-modifier-hover"
      }`}
    >
      <span
        className="flex items-center"
        ref={(el) => (el && setIcon(el, getDirectionIconName(direction))) || undefined}
      />
      {label}
    </div>
  );

const DirectionToggle = ({
  onKeyDown,
  onSelect,
  registerRef,
  sortDirection,
  sortKey,
}: {
  onKeyDown: (
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => void;
  onSelect: (direction: SortDirection) => void;
  registerRef: (index: number, element: HTMLDivElement | null) => void;
  sortDirection: SortDirection;
  sortKey: SortKey;
}): ReactElement => (
  <div className="border-modifier-border flex gap-[var(--size-4-1)] border-t p-[var(--size-4-2)]">
    {DIRECTIONS.map(({ direction, label }, index) => (
      <DirectionButton
        key={direction}
        direction={direction}
        isSelected={direction === sortDirection}
        label={label}
        onKeyDown={(event) => onKeyDown(event, index)}
        onSelect={() => onSelect(direction)}
        registerRef={(element) => registerRef(index, element)}
        title={getSortDirectionLabel({ sortKey, direction })}
      />
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

  const optionRowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const directionRowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Matches the other toolbar dropdowns: the panel is keyboard-ready the
  // moment it opens, focused on the option that's actually selected rather
  // than always the first row. Gated on `isOpen` (not a mount-only effect):
  // unlike the rows themselves, `NodeSortMenu` stays mounted across every
  // open/close of the dropdown, so a `[]` dependency array would only ever
  // fire once, before the panel — and its refs — exist for the first time.
  useEffect(() => {
    if (!isOpen) return;
    const selectedIndex = SORT_OPTIONS.findIndex(
      (option) => option.key === sortKey,
    );
    optionRowRefs.current[selectedIndex === -1 ? 0 : selectedIndex]?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // One continuous, wrapping list — the 5 sort-by rows followed by the 2
  // direction buttons — rather than two independently-navigated groups. A
  // separate Left/Right scheme for the direction buttons only works once
  // focus has already reached them by some other means (Tab), which isn't
  // discoverable; landing there by just continuing to press Down is.
  const TOTAL_ROW_COUNT = SORT_OPTIONS.length + DIRECTIONS.length;

  const focusRowAt = (combinedIndex: number): void => {
    if (combinedIndex < SORT_OPTIONS.length) {
      optionRowRefs.current[combinedIndex]?.focus();
      return;
    }
    directionRowRefs.current[combinedIndex - SORT_OPTIONS.length]?.focus();
  };

  const handleRowKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    combinedIndex: number,
  ): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusRowAt((combinedIndex + 1) % TOTAL_ROW_COUNT);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusRowAt((combinedIndex - 1 + TOTAL_ROW_COUNT) % TOTAL_ROW_COUNT);
    }
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
      title={`Sort by ${getSortOptionLabel(sortKey)} — ${directionLabel}`}
    >
      <div role="group" className="pb-[var(--size-4-1)]">
        <div className="text-muted px-[var(--size-4-3)] pb-[var(--size-4-1)] pt-[var(--size-4-2)] text-[length:var(--font-ui-smaller)]">
          Sort by
        </div>
        {SORT_OPTIONS.map((option, index) => (
          <SortOptionRow
            key={option.key}
            isSelected={option.key === sortKey}
            label={option.label}
            onKeyDown={(event) => handleRowKeyDown(event, index)}
            onSelect={() =>
              onSortChange({
                sortKey: option.key,
                direction:
                  option.key === sortKey
                    ? sortDirection
                    : getDefaultDirectionForKey(option.key),
              })
            }
            registerRef={(element) => {
              optionRowRefs.current[index] = element;
            }}
          />
        ))}
      </div>
      <DirectionToggle
        onKeyDown={(event, index) =>
          handleRowKeyDown(event, SORT_OPTIONS.length + index)
        }
        onSelect={(direction) => onSortChange({ sortKey, direction })}
        registerRef={(index, element) => {
          directionRowRefs.current[index] = element;
        }}
        sortDirection={sortDirection}
        sortKey={sortKey}
      />
    </SearchDropdown>
  );
};
