import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Icon,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  Position,
} from "@blueprintjs/core";
import {
  buildSettingsCatalog,
  type SearchableEntry,
} from "../utils/settingsCatalog";
import { rankSettings } from "../utils/settingsSearch";

const SettingsSearchResult = ({
  entry,
  isActive,
  onSelect,
}: {
  entry: SearchableEntry;
  isActive: boolean;
  onSelect: (entry: SearchableEntry) => void;
}): JSX.Element => (
  <MenuItem
    // `data-active` is what the scroll effect looks for, mirroring
    // DiscourseNodeSearchMenu.
    data-active={isActive}
    active={isActive}
    icon={entry.kind === "page" ? "document" : "cog"}
    shouldDismissPopover={false}
    text={
      <div className="flex flex-col">
        <span>{entry.label}</span>
        {/* Undimmed on purpose: white on the active row's `#137CBD` is 4.5:1, and any
            opacity below 100% drops under AA for text this size (80% measures 3.5:1). */}
        <span
          className={`text-xs ${isActive ? "text-inherit" : "text-gray-500"}`}
        >
          {entry.breadcrumb}
        </span>
      </div>
    }
    // Selecting on mousedown so the choice lands before the input's blur closes
    // the list out from under the pointer.
    onMouseDown={(event: React.MouseEvent) => {
      event.preventDefault();
      onSelect(entry);
    }}
  />
);

/** Results are a portalled Popover because the tab list this field sits in is styled
 *  `overflow-y: auto; overflow-x: hidden`, which clips an in-flow dropdown on both axes. */
const SettingsSearchField = ({
  onSelect,
}: {
  onSelect: (entry: SearchableEntry) => void;
}): JSX.Element => {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(
    () => rankSettings({ entries: buildSettingsCatalog(), query }),
    [query],
  );
  const isShowingResults = isOpen && query.trim() !== "";

  // Keeps the keyboard-selected row visible when the list scrolls, following
  // the same approach as DiscourseNodeSearchMenu.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const activeItem = container.querySelector<HTMLElement>(
      '[data-active="true"]',
    );
    if (!activeItem) return;
    const containerRect = container.getBoundingClientRect();
    const itemRect = activeItem.getBoundingClientRect();
    if (
      itemRect.bottom > containerRect.bottom ||
      itemRect.top < containerRect.top
    ) {
      activeItem.scrollIntoView({ block: "nearest", behavior: "auto" });
    }
  }, [activeIndex, results]);

  const select = (entry: SearchableEntry) => {
    onSelect(entry);
    setQuery("");
    setIsOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      // Stopping propagation so Escape clears the search rather than closing
      // the whole Settings dialog out from under a half-typed query.
      if (query !== "") event.stopPropagation();
      setQuery("");
      setIsOpen(false);
      return;
    }
    if (!isShowingResults || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = results[activeIndex];
      if (entry) select(entry);
    }
  };

  return (
    <Popover
      isOpen={isShowingResults}
      // `flip`/`preventOverflow` off: the rail is at the window edge, so Blueprint's
      // overflow handling pushes the list off the dialog instead of across it.
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
      minimal={true}
      autoFocus={false}
      enforceFocus={false}
      fill={true}
      popoverClassName="dg-settings-search__results"
      content={
        results.length === 0 ? (
          <div className="flex items-center gap-2 p-3 text-sm text-gray-500">
            <Icon icon="search" iconSize={12} />
            <span>No settings match “{query.trim()}”</span>
          </div>
        ) : (
          <div className="dg-settings-search__scroll" ref={scrollContainerRef}>
            <Menu>
              {results.map((entry, index) => (
                <SettingsSearchResult
                  key={entry.id}
                  entry={entry}
                  isActive={index === activeIndex}
                  onSelect={select}
                />
              ))}
            </Menu>
          </div>
        )
      }
    >
      <div className="dg-settings-search mb-2">
        <InputGroup
          inputRef={(input) => {
            inputRef.current = input;
          }}
          leftIcon="search"
          placeholder="Search settings"
          value={query}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
        />
      </div>
    </Popover>
  );
};

export default SettingsSearchField;
