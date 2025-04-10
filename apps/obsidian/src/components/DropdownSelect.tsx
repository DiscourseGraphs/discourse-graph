import { DropdownComponent } from "obsidian";
import { useEffect, useRef } from "react";

type DropdownSelectProps<T> = {
  options: T[];
  onSelect: (item: T | null) => void;
  placeholder?: string;
  getItemText: (item: T) => string;
};

const DropdownSelect = <T,>({
  options,
  onSelect,
  placeholder = "Select...",
  getItemText,
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
      dropdown.setValue(value);
      onSelect(selectedOption);
    };

    dropdown.onChange(onChangeHandler);

    if (options && options.length === 1 && !currentValue) {
      dropdown.setValue(getItemText(options[0] as T));
    }

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
