import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  Button,
  Icon,
  TextArea,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  PopoverPosition,
} from "@blueprintjs/core";
import fuzzy from "fuzzy";
import { Result } from "~/utils/types";

type FuzzySelectInputProps<T extends Result = Result> = {
  value?: T;
  setValue: (q: T) => void;
  onLockedChange?: (isLocked: boolean) => void;
  mode: "create" | "edit";
  initialUid: string;
  options?: T[];
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
};

const FuzzySelectInput = <T extends Result = Result>({
  value,
  setValue,
  onLockedChange,
  mode,
  initialUid,
  options = [],
  placeholder = "Enter value",
  autoFocus,
  disabled,
}: FuzzySelectInputProps<T>) => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockedValue, setLockedValue] = useState<T | undefined>(undefined);
  const [query, setQuery] = useState<string>(() => value?.text || "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const menuRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fuzzy filter options
  const filteredItems = useMemo(() => {
    if (!query) return options;
    return fuzzy
      .filter(query, options, { extract: (item) => item.text })
      .map((result) => result.original);
  }, [query, options]);

  // Handle option selection
  const handleSelect = useCallback(
    (item: T) => {
      if (mode === "create" && item.uid && item.uid !== initialUid) {
        // Lock the value
        setLockedValue(item);
        setIsLocked(true);
        setQuery(item.text);
        setValue(item);
        setIsOpen(false);
        onLockedChange?.(true);
      } else {
        // Just update the value
        setQuery(item.text);
        setValue(item);
        setIsOpen(false);
      }
    },
    [mode, initialUid, setValue, onLockedChange],
  );

  // Handle clear locked value
  const handleClear = useCallback(() => {
    setIsLocked(false);
    setLockedValue(undefined);
    setQuery("");
    setValue({ text: "", uid: "" } as T);
    onLockedChange?.(false);
  }, [setValue, onLockedChange]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < filteredItems.length - 1 ? prev + 1 : prev,
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        if (isOpen && filteredItems[activeIndex]) {
          handleSelect(filteredItems[activeIndex]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    },
    [filteredItems, activeIndex, isOpen, handleSelect],
  );

  // Update value as user types
  useEffect(() => {
    if (mode === "create" && !isLocked) {
      setValue({ text: query, uid: "" } as T);
    }
  }, [query, mode, isLocked, setValue]);

  // Open/close dropdown based on filtered items
  useEffect(() => {
    if (filteredItems.length > 0 && query) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [filteredItems.length, query]);

  // Reset active index when filtered items change
  useEffect(() => {
    setActiveIndex(0);
  }, [filteredItems]);

  // Scroll active item into view
  useEffect(() => {
    if (menuRef.current && isOpen) {
      const activeElement = menuRef.current.children[
        activeIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [activeIndex, isOpen]);

  // Edit mode: simple TextArea
  if (mode === "edit") {
    return (
      <TextArea
        value={value?.text || ""}
        onChange={(e) => {
          setValue({ text: e.target.value, uid: value?.uid || "" } as T);
        }}
        fill
        growVertically
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled}
      />
    );
  }

  // Create mode: locked value display
  if (isLocked && lockedValue) {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded border border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
          <Icon
            icon="lock"
            iconSize={14}
            className="text-gray-600 dark:text-gray-400"
          />
          <span className="flex-1 text-gray-900 dark:text-gray-100">
            {lockedValue.text}
          </span>
          <Button
            icon="cross"
            minimal
            small
            onClick={handleClear}
            className="flex-shrink-0"
            aria-label="Clear selection"
          />
        </div>
      </div>
    );
  }

  // Create mode: fuzzy search input
  return (
    <Popover
      isOpen={isOpen}
      minimal
      autoFocus={false}
      enforceFocus={false}
      position={PopoverPosition.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
      content={
        <Menu className="max-h-64 max-w-md overflow-auto" ulRef={menuRef}>
          {filteredItems.map((item, index) => (
            <MenuItem
              key={item.uid || index}
              text={item.text}
              active={activeIndex === index}
              onClick={() => handleSelect(item)}
              multiline
            />
          ))}
        </Menu>
      }
      target={
        <InputGroup
          disabled={disabled}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder}
          inputRef={inputRef}
          onBlur={() => {
            setTimeout(() => setIsOpen(false), 200);
          }}
          onFocus={() => {
            if (filteredItems.length > 0 && query) {
              setIsOpen(true);
            }
          }}
        />
      }
    />
  );
};

export default FuzzySelectInput;

