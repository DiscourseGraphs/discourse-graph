import React, { useCallback, useRef, useState } from "react";
import {
  Button,
  ButtonGroup,
  Menu,
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

const SortDirectionToggles = ({
  direction,
  field,
  isSelected,
  onDirectionChange,
}: {
  direction: SortDirection;
  field: SortField;
  isSelected: boolean;
  onDirectionChange: (direction: SortDirection) => void;
}): React.ReactElement => (
  <ButtonGroup
    className="shrink-0"
    minimal
    onClick={(event) => event.stopPropagation()}
  >
    <Button
      active={isSelected && direction === "asc"}
      aria-label={`${SORT_FIELD_LABELS[field]} ascending`}
      icon="arrow-up"
      minimal
      onClick={(event) => {
        event.stopPropagation();
        onDirectionChange("asc");
      }}
      onMouseDown={(event) => event.preventDefault()}
      small
    />
    <Button
      active={isSelected && direction === "desc"}
      aria-label={`${SORT_FIELD_LABELS[field]} descending`}
      icon="arrow-down"
      minimal
      onClick={(event) => {
        event.stopPropagation();
        onDirectionChange("desc");
      }}
      onMouseDown={(event) => event.preventDefault()}
      small
    />
  </ButtonGroup>
);

const SortPopoverMenu = ({
  onSortChange,
  sort,
}: {
  onSortChange: (sort: SortConfig) => void;
  sort: SortConfig;
}): React.ReactElement => (
  <Menu className="w-60">
    <MenuItem disabled shouldDismissPopover={false} text="Sort by" />
    {SORT_FIELDS.map((field) => {
      const isSelected = sort.field === field;
      return (
        <MenuItem
          key={field}
          active={isSelected}
          icon={isSelected ? "tick" : "blank"}
          labelElement={
            <SortDirectionToggles
              direction={sort.direction}
              field={field}
              isSelected={isSelected}
              onDirectionChange={(direction) =>
                onSortChange({ field, direction })
              }
            />
          }
          onClick={() => onSortChange({ field, direction: sort.direction })}
          shouldDismissPopover={false}
          text={SORT_FIELD_LABELS[field]}
        />
      );
    })}
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

  const applySort = useCallback(
    (nextSort: SortConfig): void => {
      onSortChange(nextSort);
      setIsOpen(false);
    },
    [onSortChange],
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
        content={<SortPopoverMenu onSortChange={applySort} sort={sort} />}
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
