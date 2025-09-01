import { AbstractInputSuggest, App } from "obsidian";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePlugin } from "./PluginContext";

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
  getItemText,
  renderItem,
  asyncSearch,
  disabled = false,
  className,
}: {
  onSelect: (item: T | null) => void;
  placeholder?: string;
  getItemText: (item: T) => string;
  renderItem?: (item: T, el: HTMLElement) => void;
  asyncSearch: (query: string) => Promise<T[]>;
  disabled?: boolean;
  className?: string;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<T | null>(null);
  const plugin = usePlugin();
  const app = plugin.app;
  const asyncSearchRef = useRef(asyncSearch);

  useEffect(() => {
    asyncSearchRef.current = asyncSearch;
  }, [asyncSearch]);

  useEffect(() => {
    if (!inputRef.current || !app) return;
    const suggest = new GenericSuggest<T>(
      app,
      inputRef.current,
      (item) => {
        setSelected(item);
        onSelect(item);
        inputRef.current?.blur();
      },
      {
        getItemText: (item: T) => getItemText(item),
        renderItem: (item: T, el: HTMLElement) => {
          if (renderItem) {
            renderItem(item, el);
            return;
          }
          el.setText(getItemText(item));
        },
        asyncSearch: (query: string) => asyncSearchRef.current(query),
      },
    );
    return () => suggest.close();
  }, [app, getItemText, renderItem, onSelect, asyncSearch]);

  const clearSelection = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = "";
      setSelected(null);
      onSelect(null);
    }
  }, [onSelect]);

  return (
    <div className="relative flex items-center">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder || "Search..."}
        className={`border-modifier-border flex-1 rounded border p-2 pr-8 bg-${
          selected || disabled ? "secondary" : "primary"
        } ${disabled ? "cursor-not-allowed opacity-70" : "cursor-text"} ${className}`}
        readOnly={!!selected || disabled}
        disabled={disabled}
      />
      {selected && !disabled && (
        <button
          onClick={clearSelection}
          className="text-muted hover:text-normal absolute right-2 flex h-4 w-4 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-xs"
          aria-label="Clear selection"
        >
          ✕
        </button>
      )}
    </div>
  );
};

export default SearchBar;
