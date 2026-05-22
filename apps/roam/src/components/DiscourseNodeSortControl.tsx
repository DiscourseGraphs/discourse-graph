import React, { useCallback, useRef, useState } from "react";
import {
  Button,
  ButtonGroup,
  Menu,
  MenuDivider,
  MenuItem,
  Popover,
  Position,
} from "@blueprintjs/core";
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

const SortDirectionFooter = ({
  direction,
  onDirectionChange,
}: {
  direction: SortDirection;
  onDirectionChange: (direction: SortDirection) => void;
}): React.ReactElement => (
  <div
    className="px-2 py-2"
    onClick={(event) => event.stopPropagation()}
    onMouseDown={(event) => event.preventDefault()}
  >
    <ButtonGroup fill>
      <Button
        active={direction === "asc"}
        aria-label="Ascending"
        icon="sort-asc"
        onClick={() => onDirectionChange("asc")}
        small
        text="Asc"
      />
      <Button
        active={direction === "desc"}
        aria-label="Descending"
        icon="sort-desc"
        onClick={() => onDirectionChange("desc")}
        small
        text="Desc"
      />
    </ButtonGroup>
  </div>
);

const SortPopoverMenu = ({
  onSortChange,
  sort,
}: {
  onSortChange: (sort: SortConfig) => void;
  sort: SortConfig;
}): React.ReactElement => (
  <Menu className="w-56">
    <MenuItem disabled shouldDismissPopover={false} text="Sort by" />
    {SORT_FIELDS.map((field) => (
      <MenuItem
        key={field}
        active={sort.field === field}
        icon={sort.field === field ? "tick" : "blank"}
        onClick={() => onSortChange({ field, direction: sort.direction })}
        shouldDismissPopover={false}
        text={SORT_FIELD_LABELS[field]}
      />
    ))}
    <MenuDivider />
    <SortDirectionFooter
      direction={sort.direction}
      onDirectionChange={(direction) =>
        onSortChange({ field: sort.field, direction })
      }
    />
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
    <span className="inline-flex shrink-0 [&_.bp3-popover-wrapper]:shrink-0">
      <Popover
        autoFocus={false}
        canEscapeKeyClose
        content={<SortPopoverMenu onSortChange={onSortChange} sort={sort} />}
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
    </span>
  );
};
