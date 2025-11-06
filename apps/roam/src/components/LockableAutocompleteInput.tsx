import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button, Classes, Icon } from "@blueprintjs/core";
import AutocompleteInput, {
  AutocompleteInputProps,
} from "roamjs-components/components/AutocompleteInput";
import { Result } from "~/utils/types";

type LockableAutocompleteInputProps<T extends Result = Result> = Omit<
  AutocompleteInputProps<T>,
  "value" | "setValue" | "onConfirm"
> & {
  value?: T;
  setValue: (q: T) => void;
  onConfirm?: () => void;
  onLockedChange?: (isLocked: boolean) => void;
};

const LockableAutocompleteInput = <T extends Result = Result>({
  value,
  setValue,
  onConfirm,
  onLockedChange,
  options = [],
  ...autocompleteProps
}: LockableAutocompleteInputProps<T>) => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockedValue, setLockedValue] = useState<T | undefined>(undefined);
  const isInternalUpdateRef = useRef(false);

  // Check if value is from options (existing node) vs new node
  const isValueFromOptions = useCallback(
    (val: T | undefined): boolean => {
      if (!val || !val.uid || !val.text) return false;
      return options.some((opt) => opt.uid === val.uid && opt.text === val.text);
    },
    [options],
  );

  // Initialize locked state from initial value
  useEffect(() => {
    if (value && isValueFromOptions(value)) {
      setLockedValue(value);
      setIsLocked(true);
      onLockedChange?.(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update locked state when value changes externally
  useEffect(() => {
    // Skip if this update was triggered internally
    if (isInternalUpdateRef.current) {
      isInternalUpdateRef.current = false;
      return;
    }

    // Lock if value matches an option and we're not already locked
    if (!isLocked && value && isValueFromOptions(value)) {
      setLockedValue(value);
      setIsLocked(true);
      onLockedChange?.(true);
    } else if (isLocked && (!value || !value.text || !isValueFromOptions(value))) {
      // Unlock if value is cleared or no longer matches an option
      setIsLocked(false);
      setLockedValue(undefined);
      onLockedChange?.(false);
    }
  }, [value, isLocked, isValueFromOptions, onLockedChange]);

  const handleSetValue = useCallback(
    (q: T) => {
      isInternalUpdateRef.current = true;
      setValue(q);
      // Lock when selecting from options
      if (isValueFromOptions(q)) {
        setLockedValue(q);
        setIsLocked(true);
        onLockedChange?.(true);
      } else {
        // Unlock if selecting a new item
        setIsLocked(false);
        setLockedValue(undefined);
        onLockedChange?.(false);
      }
    },
    [setValue, isValueFromOptions, onLockedChange],
  );

  const handleClear = useCallback(() => {
    isInternalUpdateRef.current = true;
    setIsLocked(false);
    setLockedValue(undefined);
    setValue({ text: "", uid: "" } as T);
    onLockedChange?.(false);
  }, [setValue, onLockedChange]);

  if (isLocked && lockedValue) {
    return (
      <div className="flex items-center gap-2 w-full">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-600">
          <Icon icon="lock" iconSize={14} className="text-gray-600 dark:text-gray-400" />
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

  return (
    <AutocompleteInput
      {...autocompleteProps}
      value={value}
      setValue={handleSetValue}
      onConfirm={onConfirm}
      options={options}
    />
  );
}

export default LockableAutocompleteInput;

