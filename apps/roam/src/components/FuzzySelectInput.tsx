import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import {
  Button,
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
  options?: T[];
  placeholder?: string;
  autoFocus?: boolean;
  initialIsLocked?: boolean;
};

const FuzzySelectInput = <T extends Result = Result>({
  value,
  setValue,
  onLockedChange,
  mode,
  options = [],
  placeholder = "Enter value",
  autoFocus,
  initialIsLocked,
}: FuzzySelectInputProps<T>) => {
  const [isLocked, setIsLocked] = useState(initialIsLocked || false);
  const [query, setQuery] = useState<string>(() => value?.text || "");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);

  const menuRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredItems = useMemo(() => {
    if (!query) return options;
    return fuzzy
      .filter(query, options, { extract: (item) => item.text })
      .map((result) => result.original);
  }, [query, options]);

  const handleSelect = useCallback(
    (item: T) => {
      if (mode === "create" && item.uid) {
        setIsLocked(true);
        setQuery(item.text);
        setValue(item);
        setIsOpen(false);
        onLockedChange?.(true);
      } else {
        setQuery(item.text);
        setValue(item);
        setIsOpen(false);
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    },
    [mode, setValue, onLockedChange],
  );

  const handleClear = useCallback(() => {
    setIsLocked(false);
    setQuery("");
    setValue({ ...value, text: "", uid: "" } as T);
    onLockedChange?.(false);
  }, [value, setValue, onLockedChange]);

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

  useEffect(() => {
    if (mode === "create" && !isLocked) {
      setValue({ text: query, uid: "" } as T);
    }
  }, [query, mode, isLocked, setValue]);

  useEffect(() => {
    if (typeof initialIsLocked === "boolean") {
      setIsLocked(initialIsLocked);
    }
  }, [initialIsLocked]);

  useEffect(() => {
    if (isFocused && filteredItems.length > 0 && query) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [filteredItems.length, query, isFocused]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredItems]);

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

  useEffect(() => {
    if (!autoFocus || mode !== "create" || isLocked) return;
    const id = setTimeout(() => inputRef.current?.focus(), 150);
    return () => clearTimeout(id);
  }, [autoFocus, mode, isLocked]);

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
      />
    );
  }

  if (isLocked) {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded border border-gray-300 bg-gray-100 px-3 py-2 dark:border-gray-600 dark:bg-gray-800">
          <span className="flex-1 text-gray-900 dark:text-gray-100">
            {value?.text}
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

  return (
    <Popover
      isOpen={isOpen}
      minimal
      position={PopoverPosition.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
      className="fuzzy-select-input-popover w-full"
      autoFocus={false}
      enforceFocus={false}
      content={
        <Menu className="max-h-64 max-w-md overflow-auto" ulRef={menuRef}>
          {filteredItems.map((item, index) => (
            <MenuItem
              key={item.uid || index}
              text={item.text}
              active={activeIndex === index}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(item);
              }}
              multiline
            />
          ))}
        </Menu>
      }
      target={
        <InputGroup
          fill
          inputRef={inputRef}
          className="w-full"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onFocus={() => {
            setIsFocused(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setIsOpen(false), 200);
          }}
        />
      }
    />
  );
};

export default FuzzySelectInput;
