import { App, debounce } from "obsidian";
import React, { useEffect, useState, useMemo, ReactNode } from "react";
import { QueryEngine } from "~/services/QueryEngine";

type SearchBarBaseProps<T> = {
  app: App;
  placeholder?: string;
  onNodeSelect: (item: T | null) => void;
  debounceMs?: number;
  minQueryLength?: number;
  getItemText: (item: T) => string;
  getItemKey: (item: T) => string;
  renderItemContent?: (item: T, isSelected?: boolean) => ReactNode;
  itemStyle?: React.CSSProperties;
  containerStyle?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  resultsContainerStyle?: React.CSSProperties;
};

type OptionsSearchBarProps<T> = SearchBarBaseProps<T> & {
  options: T[];
  searchFunction?: (query: string) => Promise<T[]>;
};

type FunctionSearchBarProps<T> = SearchBarBaseProps<T> & {
  options?: never;
  searchFunction: (query: string) => Promise<T[]>;
};

export type SearchBarProps<T> =
  | OptionsSearchBarProps<T>
  | FunctionSearchBarProps<T>;

export function SearchBar<T extends {}>({
  app,
  placeholder = "Search (type at least 2 characters)...",
  searchFunction,
  onNodeSelect,
  debounceMs = 250,
  minQueryLength = 2,
  options,
  getItemText,
  getItemKey,
  renderItemContent,
  itemStyle = {},
  containerStyle = {},
  inputStyle = {},
  resultsContainerStyle = {},
}: SearchBarProps<T>) {
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResults, setSearchResults] = useState<T[]>(options || []);
  const [selectedItem, setSelectedItem] = useState<T | null>(null);
  const [isSearching, setIsSearching] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);

  const queryEngine = new QueryEngine(app);
  const defaultFuzzySearch = (query: string) => {
    if (!options) return [];
    return options.filter((item) =>
      queryEngine.fuzzySearch(getItemText(item), query),
    );
  };

  const effectiveSearchFunction = searchFunction
    ? searchFunction
    : defaultFuzzySearch;

  const debouncedSearch = useMemo(
    () =>
      debounce(async (query: string) => {
        if (!effectiveSearchFunction) return;

        if (!query || query.length < minQueryLength) {
          setSearchResults(options || []);
          return;
        }

        const results = await effectiveSearchFunction(query);
        setSearchResults(results);
      }, debounceMs),
    [effectiveSearchFunction, minQueryLength, debounceMs, options],
  );

  useEffect(() => {
    if (isSearching) {
      debouncedSearch(searchQuery);
    }
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchQuery, debouncedSearch, isSearching]);

  useEffect(() => {
    if (options) {
      setSearchResults(options);
    }
  }, [options]);

  const handleItemSelect = (item: T) => {
    setSelectedItem(item);
    setSearchQuery(getItemText(item));
    setIsSearching(false);
    onNodeSelect(item);
  };

  const handleClearSelection = () => {
    setSelectedItem(null);
    setSearchQuery("");
    setIsSearching(true);
    onNodeSelect(null);
  };

  const defaultRenderItemContent = (item: T, isSelected: boolean) => (
    <div>{getItemText(item)}</div>
  );

  const shouldShowResults =
    isSearching &&
    (searchResults.length > 0 || (isInputFocused && minQueryLength === 0));

  return (
    <div
      className="search-container"
      style={{
        marginBottom: "1rem",
        ...containerStyle,
      }}
    >
      <div style={{ position: "relative" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            if (!isSearching) {
              setIsSearching(true);
              setSelectedItem(null);
              onNodeSelect(null);
            }
          }}
          onFocus={() => setIsInputFocused(true)}
          onBlur={() => setIsInputFocused(false)}
          placeholder={isSearching ? placeholder : "Selected item"}
          readOnly={!isSearching && selectedItem !== null}
          style={{
            width: "100%",
            padding: "8px",
            paddingRight: selectedItem ? "36px" : "8px",
            border: "1px solid var(--background-modifier-border)",
            borderRadius: "4px",
            backgroundColor: !isSearching
              ? "var(--background-secondary)"
              : "var(--background-primary)",
            ...inputStyle,
          }}
        />
        {selectedItem && (
          <button
            onClick={handleClearSelection}
            style={{
              position: "absolute",
              right: "4px",
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "4px",
            }}
            aria-label="Clear selection"
          >
            ✕
          </button>
        )}
      </div>

      {shouldShowResults && (
        <div
          className="search-results"
          style={{
            maxHeight: "200px",
            overflowY: "auto",
            marginTop: "4px",
            border: "1px solid var(--background-modifier-border)",
            borderRadius: "4px",
            ...resultsContainerStyle,
          }}
        >
          {searchResults.map((item, index) => {
            const isSelected = selectedItem === item;
            const isHovered = hoverIndex === index;

            return (
              <div
                key={getItemKey(item)}
                className="search-item"
                style={{
                  padding: "0.5rem",
                  cursor: "pointer",
                  borderBottom: "1px solid var(--background-modifier-border)",
                  backgroundColor:
                    isSelected || isHovered
                      ? "var(--background-modifier-hover)"
                      : undefined,
                  ...itemStyle,
                }}
                onMouseEnter={() => setHoverIndex(index)}
                onMouseLeave={() => setHoverIndex(null)}
                onClick={() => handleItemSelect(item)}
              >
                {renderItemContent
                  ? renderItemContent(item, isSelected)
                  : defaultRenderItemContent(item, isSelected)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
