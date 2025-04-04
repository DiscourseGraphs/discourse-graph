import { AbstractInputSuggest, App } from "obsidian";
import { useEffect, useRef, useState } from "react";

class GenericSuggest<T> extends AbstractInputSuggest<T> {
  private getItemTextFn: (item: T) => string;
  private renderItemFn: (item: T, el: HTMLElement) => void;
  private onSelectCallback: (item: T) => void;
  private asyncSearchFn: (query: string) => Promise<T[]>;
  private minQueryLength: number;
  private debounceTimeout: number | null = null;

  constructor(
    app: App,
    private textInputEl: HTMLInputElement,
    onSelectCallback: (item: T) => void,
    config: {
      getItemText: (item: T) => string;
      renderItem?: (item: T, el: HTMLElement) => void;
      asyncSearch: (query: string) => Promise<T[]>;
      minQueryLength?: number;
    },
  ) {
    super(app, textInputEl);
    this.onSelectCallback = onSelectCallback;
    this.getItemTextFn = config.getItemText;
    this.renderItemFn = config.renderItem || this.defaultRenderItem.bind(this);
    this.asyncSearchFn = config.asyncSearch;
    this.minQueryLength = config.minQueryLength || 0;
  }

  async getSuggestions(inputStr: string): Promise<T[]> {
    const query = inputStr.trim();
    if (query.length < this.minQueryLength) {
      return [];
    }

    return new Promise((resolve) => {
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = window.setTimeout(async () => {
        try {
          const results = await this.asyncSearchFn(query);
          resolve(results);
        } catch (error) {
          console.error(`[GenericSuggest] Error in async search:`, error);
          resolve([]);
        }
      }, 250);
    });
  }

  private defaultRenderItem(item: T, el: HTMLElement): void {
    el.setText(this.getItemTextFn(item));
  }

  renderSuggestion(item: T, el: HTMLElement): void {
    this.renderItemFn(item, el);
  }

  selectSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void {
    this.textInputEl.value = this.getItemTextFn(item);
    this.onSelectCallback(item);
    this.close();
  }
}

const SearchBar = <T,>({
  onSelect,
  placeholder,
  app,
  getItemText,
  renderItem,
  asyncSearch,
  minQueryLength = 0,
}: {
  onSelect: (item: T | null) => void;
  placeholder?: string;
  app: App;
  getItemText: (item: T) => string;
  renderItem?: (item: T, el: HTMLElement) => void;
  asyncSearch: (query: string) => Promise<T[]>;
  minQueryLength?: number;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<T | null>(null);

  useEffect(() => {
    if (inputRef.current && app) {
      const suggest = new GenericSuggest(
        app,
        inputRef.current,
        (item) => {
          setSelected(item);
          onSelect(item);
        },
        {
          getItemText,
          renderItem,
          asyncSearch,
          minQueryLength,
        },
      );
      return () => suggest.close();
    }
  }, [onSelect, app, getItemText, renderItem, asyncSearch, minQueryLength]);

  const clearSelection = () => {
    if (inputRef.current) {
      inputRef.current.value = "";
      setSelected(null);
      onSelect(null);
    }
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || "Search..."}
        style={{
          width: "100%",
          padding: "8px",
          paddingRight: selected ? "36px" : "8px",
          border: "1px solid var(--background-modifier-border)",
          borderRadius: "4px",
          backgroundColor: selected
            ? "var(--background-secondary)"
            : "var(--background-primary)",
        }}
        readOnly={!!selected}
      />
      {selected && (
        <button
          onClick={clearSelection}
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
  );
};

export default SearchBar;
