import { App, DropdownComponent } from "obsidian";
import React, { useEffect, useRef, useState } from "react";

interface DropdownSelectProps<T> {
  options: T[];
  onSelect: (item: T | null) => void;
  placeholder?: string;
  app: App;
  getItemText: (item: T) => string;
  renderItem?: (item: T, el: HTMLElement) => void;
}

const DropdownSelect = <T,>({
  options,
  onSelect,
  placeholder = "Select...",
  app,
  getItemText,
  renderItem,
}: DropdownSelectProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<DropdownComponent | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!dropdownRef.current) {
      dropdownRef.current = new DropdownComponent(containerRef.current);
    }

    const dropdown = dropdownRef.current;
    const currentValue = dropdown.getValue();

    dropdown.selectEl.empty();

    dropdown.addOption("", placeholder);

    options.forEach((option) => {
      const text = getItemText(option);
      dropdown.addOption(text, text);
    });

    if (
      currentValue &&
      options.some((opt) => getItemText(opt) === currentValue)
    ) {
      dropdown.setValue(currentValue);
    }

    const onChangeHandler = (value: string) => {
      const selectedOption =
        options.find((opt) => getItemText(opt) === value) || null;
      dropdown.setValue(value); // Set the dropdown's displayed value
      onSelect(selectedOption);
    };

    dropdown.onChange(onChangeHandler);

    return () => {
      dropdown.onChange(() => {});
    };
  }, [options, onSelect, getItemText, placeholder]);

  useEffect(() => {
    return () => {
      if (dropdownRef.current) {
        dropdownRef.current.selectEl.empty();
        dropdownRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="dropdown-select"
      style={{
        width: "100%",
        position: "relative",
      }}
    />
  );
};

export default DropdownSelect;
