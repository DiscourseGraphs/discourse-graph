import React, { useCallback, useRef, useState } from "react";
import { Button, Icon, Popover, Position } from "@blueprintjs/core";
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
  <span
    className="inline-flex gap-0.5"
    onClick={(event) => event.stopPropagation()}
    role="presentation"
  >
    <button
      aria-label={`${SORT_FIELD_LABELS[field]} ascending`}
      className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-gray-400 hover:bg-gray-100 hover:text-gray-900 ${
        isSelected && direction === "asc" ? "bg-blue-700/10 text-blue-700" : ""
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onDirectionChange("asc");
      }}
      onMouseDown={(event) => event.preventDefault()}
      type="button"
    >
      <Icon icon="arrow-up" size={12} />
    </button>
    <button
      aria-label={`${SORT_FIELD_LABELS[field]} descending`}
      className={`inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 text-gray-400 hover:bg-gray-100 hover:text-gray-900 ${
        isSelected && direction === "desc" ? "bg-blue-700/10 text-blue-700" : ""
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onDirectionChange("desc");
      }}
      onMouseDown={(event) => event.preventDefault()}
      type="button"
    >
      <Icon icon="arrow-down" size={12} />
    </button>
  </span>
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
        content={
          <div className="w-60 overflow-hidden">
            <div className="px-3 pb-1 pt-2 text-xs font-medium text-gray-500">
              Sort by
            </div>
            {SORT_FIELDS.map((field) => {
              const isSelected = sort.field === field;
              return (
                <button
                  key={field}
                  className={`grid w-full cursor-pointer items-center gap-2 border-0 px-3 py-1.5 text-left text-sm text-gray-900 hover:bg-gray-50 ${
                    isSelected ? "bg-blue-700/[0.07]" : "bg-transparent"
                  }`}
                  style={{
                    gridTemplateColumns: "22px 1fr auto",
                  }}
                  onClick={() =>
                    applySort({ field, direction: sort.direction })
                  }
                  type="button"
                >
                  <span className="inline-flex items-center justify-center text-blue-700">
                    {isSelected && <Icon icon="tick" size={12} />}
                  </span>
                  <span className={isSelected ? "font-semibold" : ""}>
                    {SORT_FIELD_LABELS[field]}
                  </span>
                  <SortDirectionToggles
                    direction={sort.direction}
                    field={field}
                    isSelected={isSelected}
                    onDirectionChange={(direction) =>
                      applySort({ field, direction })
                    }
                  />
                </button>
              );
            })}
          </div>
        }
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
