import React, { useCallback, useRef, useState } from "react";
import { Button, Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import {
  SORT_FIELD_LABELS,
  isNonDefaultSort,
  type SortConfig,
  type SortDirection,
  type SortField,
} from "~/components/AdvancedNodeSearchDialog/utils";

const SORT_FIELDS: SortField[] = [
  "relevance",
  "alphabetical",
  "dateCreated",
  "author",
];

export type DiscourseNodeSortControlProps = {
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
  disabled?: boolean;
};

const SortPopoverMenu = ({
  onFieldChange,
  sort,
}: {
  onFieldChange: (field: SortField) => void;
  sort: SortConfig;
}): React.ReactElement => (
  <Menu className="w-52">
    <MenuItem disabled shouldDismissPopover={false} text="Sort by" />
    {SORT_FIELDS.map((field) => (
      <MenuItem
        key={field}
        active={sort.field === field}
        icon={sort.field === field ? "tick" : "blank"}
        onClick={() => onFieldChange(field)}
        shouldDismissPopover={false}
        text={SORT_FIELD_LABELS[field]}
      />
    ))}
  </Menu>
);

export const DiscourseNodeSortControl = ({
  disabled = false,
  onSortChange,
  sort,
}: DiscourseNodeSortControlProps): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLElement | null>(null);

  const sortLabel = SORT_FIELD_LABELS[sort.field];
  const isTriggerActive = isOpen || isNonDefaultSort(sort);
  const directionIcon = sort.direction === "asc" ? "arrow-up" : "arrow-down";

  const handlePopoverInteraction = useCallback(
    (nextOpen: boolean, event?: React.SyntheticEvent<HTMLElement>): void => {
      if (disabled) return;
      if (nextOpen) {
        event?.stopPropagation();
      }
      setIsOpen(nextOpen);
    },
    [disabled],
  );

  const applyField = useCallback(
    (field: SortField): void => {
      onSortChange({ field, direction: sort.direction });
      setIsOpen(false);
    },
    [onSortChange, sort.direction],
  );

  const toggleDirection = useCallback((): void => {
    const nextDirection: SortDirection =
      sort.direction === "asc" ? "desc" : "asc";
    onSortChange({ field: sort.field, direction: nextDirection });
  }, [onSortChange, sort.direction, sort.field]);

  const sortButton = (
    <Button
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-label={`Sort by ${sortLabel}`}
      className={`${
        isTriggerActive
          ? "!bg-[rgba(95,87,192,0.1)] !text-[#5f57c0]"
          : "!text-gray-600 hover:!bg-gray-100 hover:!text-gray-900"
      }`}
      disabled={disabled}
      elementRef={triggerRef}
      icon="sort"
      minimal
      onMouseDown={(event) => event.preventDefault()}
      title={`Sort: ${sortLabel}`}
    />
  );

  return (
    <span className="inline-flex shrink-0 items-center gap-0.5 [&_.bp3-popover-wrapper]:shrink-0">
      <Popover
        autoFocus={false}
        canEscapeKeyClose
        content={<SortPopoverMenu onFieldChange={applyField} sort={sort} />}
        disabled={disabled}
        enforceFocus={false}
        isOpen={isOpen}
        minimal
        modifiers={{
          flip: { enabled: true },
          preventOverflow: { enabled: true, boundariesElement: "viewport" },
        }}
        onClose={() => setIsOpen(false)}
        onInteraction={handlePopoverInteraction}
        popoverRef={popoverRef}
        position={Position.BOTTOM_RIGHT}
        target={sortButton}
        usePortal
      />
      <Button
        aria-label={`${sortLabel} ${sort.direction === "asc" ? "ascending" : "descending"}`}
        className="!text-gray-600 hover:!bg-gray-100 hover:!text-gray-900"
        disabled={disabled}
        icon={directionIcon}
        minimal
        onClick={toggleDirection}
        onMouseDown={(event) => event.preventDefault()}
        small
        title={`${sort.direction === "asc" ? "Ascending" : "Descending"}`}
      />
    </span>
  );
};
