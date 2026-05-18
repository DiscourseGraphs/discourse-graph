import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Button, Icon, Popover, Position } from "@blueprintjs/core";
import {
  SORT_FIELD_LABELS,
  type SortConfig,
  type SortDirection,
  type SortField,
  isNonDefaultSort,
} from "~/components/AdvancedNodeSearchDialog/utils";

const SORT_FIELDS: SortField[] = [
  "relevance",
  "alphabetical",
  "dateCreated",
  "author",
];

const POPOVER_CONTENT_CLASS =
  "[&_.bp3-popover-content]:overflow-hidden [&_.bp3-popover-content]:rounded-lg [&_.bp3-popover-content]:p-0";

export type DiscourseNodeSortControlProps = {
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
  onPopoverOpenChange?: (isOpen: boolean) => void;
  disabled?: boolean;
};

const useCloseOnClickOutside = ({
  isOpen,
  onClose,
  popoverRef,
  targetRef,
}: {
  isOpen: boolean;
  onClose: () => void;
  popoverRef: React.RefObject<HTMLElement | null>;
  targetRef: React.RefObject<HTMLElement>;
}): void => {
  useEffect(() => {
    if (!isOpen) return;

    const handleMouseDown = (event: MouseEvent): void => {
      const clickTarget = event.target as Node;
      if (popoverRef.current?.contains(clickTarget)) return;
      if (targetRef.current?.contains(clickTarget)) return;
      onClose();
    };

    document.addEventListener("mousedown", handleMouseDown, true);
    return () =>
      document.removeEventListener("mousedown", handleMouseDown, true);
  }, [isOpen, onClose, popoverRef, targetRef]);
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
  onPopoverOpenChange,
  onSortChange,
  sort,
}: DiscourseNodeSortControlProps): React.ReactElement => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLElement | null>(null);

  const sortLabel = useMemo(() => SORT_FIELD_LABELS[sort.field], [sort.field]);
  const isSortActive = isNonDefaultSort(sort);
  const isTriggerActive = isOpen || isSortActive;

  const setOpen = useCallback(
    (nextOpen: boolean): void => {
      setIsOpen(nextOpen);
      onPopoverOpenChange?.(nextOpen);
    },
    [onPopoverOpenChange],
  );

  const closePopover = useCallback((): void => {
    setOpen(false);
  }, [setOpen]);

  useCloseOnClickOutside({
    isOpen,
    onClose: closePopover,
    popoverRef,
    targetRef: triggerRef,
  });

  const handlePopoverInteraction = useCallback(
    (nextOpen: boolean, event?: React.SyntheticEvent<HTMLElement>): void => {
      if (disabled) return;
      if (nextOpen) {
        event?.stopPropagation();
      }
      setOpen(nextOpen);
    },
    [disabled, setOpen],
  );

  const sortButton = (
    <Button
      aria-expanded={isOpen}
      aria-haspopup="listbox"
      aria-label={`Sort by ${sortLabel}`}
      disabled={disabled}
      elementRef={triggerRef}
      icon="sort"
      minimal
      onClick={() => setOpen(!isOpen)}
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
                    onSortChange({ field, direction: sort.direction })
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
                      onSortChange({ field, direction })
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
        onClose={closePopover}
        onInteraction={handlePopoverInteraction}
        popoverClassName={POPOVER_CONTENT_CLASS}
        popoverRef={(element) => {
          popoverRef.current = element;
        }}
        position={Position.BOTTOM_RIGHT}
        target={sortButton}
        usePortal
      />
    </span>
  );
};
