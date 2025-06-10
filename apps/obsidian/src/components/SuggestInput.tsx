import React, { useRef, useEffect, useState, useCallback } from "react";
import { AbstractInputSuggest, App } from "obsidian";
import { usePlugin } from "./PluginContext";

class GenericSuggestInput<T> extends AbstractInputSuggest<T> {
  private getSuggestionsFn: (query: string) => T[];
  private onSelectCallback: (item: T) => void;
  private getDisplayTextFn: (item: T) => string;
  private renderItemFn?: (item: T, el: HTMLElement) => void;

  constructor(
    app: App,
    private textInputEl: HTMLInputElement,
    config: {
      getSuggestions: (query: string) => T[];
      onSelect: (item: T) => void;
      getDisplayText: (item: T) => string;
      renderItem?: (item: T, el: HTMLElement) => void;
    },
  ) {
    super(app, textInputEl);
    this.getSuggestionsFn = config.getSuggestions;
    this.onSelectCallback = config.onSelect;
    this.getDisplayTextFn = config.getDisplayText;
    this.renderItemFn = config.renderItem;
  }

  getSuggestions(inputStr: string): T[] {
    return this.getSuggestionsFn(inputStr);
  }

  renderSuggestion(item: T, el: HTMLElement): void {
    if (this.renderItemFn) {
      this.renderItemFn(item, el);
    } else {
      el.createDiv({
        text: this.getDisplayTextFn(item),
        cls: "suggestion-item",
      });
    }
  }

  selectSuggestion(item: T, evt: MouseEvent | KeyboardEvent): void {
    this.textInputEl.value = this.getDisplayTextFn(item);
    this.onSelectCallback(item);
    this.close();
  }
}

type SuggestInputProps<T> = {
  value: string;
  onChange: (value: string) => void;
  getSuggestions: (query: string) => T[];
  getDisplayText: (item: T) => string;
  onSelect?: (item: T) => void;
  renderItem?: (item: T, el: HTMLElement) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

const SuggestInput = <T,>({
  value,
  onChange,
  getSuggestions,
  getDisplayText,
  onSelect,
  renderItem,
  placeholder = "Enter value",
  className = "",
  disabled = false,
}: SuggestInputProps<T>) => {
  const plugin = usePlugin();
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggest, setSuggest] = useState<GenericSuggestInput<T> | null>(null);

  const handleSelect = useCallback(
    (item: T) => {
      const displayText = getDisplayText(item);
      onChange(displayText);
      onSelect?.(item);
    },
    [getDisplayText, onChange, onSelect],
  );

  useEffect(() => {
    if (inputRef.current && !suggest && !disabled) {
      const genericSuggest = new GenericSuggestInput<T>(
        plugin.app,
        inputRef.current,
        {
          getSuggestions,
          onSelect: handleSelect,
          getDisplayText,
          renderItem,
        },
      );
      setSuggest(genericSuggest);

      return () => {
        genericSuggest.close();
        setSuggest(null);
      };
    }
  }, [
    plugin.app,
    getSuggestions,
    getDisplayText,
    renderItem,
    disabled,
    handleSelect,
  ]);

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
      autoComplete="off"
    />
  );
};

export default SuggestInput;
