import React, { useState, useCallback } from "react";
import { Button, Icon, TextArea } from "@blueprintjs/core";
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
  mode: "create" | "edit";
};

const LockableAutocompleteInput = <T extends Result = Result>({
  value,
  setValue,
  onConfirm,
  onLockedChange,
  mode,
  options = [],
  ...autocompleteProps
}: LockableAutocompleteInputProps<T>) => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockedValue, setLockedValue] = useState<T | undefined>(undefined);

  const handleSetValue = useCallback(
    (q: T) => {
      // In create mode, when user selects an option from suggestions, lock it
      if (
        mode === "create" &&
        q.text &&
        options.some((opt) => opt.text === q.text)
      ) {
        setLockedValue(q);
        setIsLocked(true);
        onLockedChange?.(true);
        setValue(q);
        return;
      }

      // Otherwise, just update the value (user is typing)
      setValue(q);
    },
    [setValue, onLockedChange, mode, options],
  );

  const handleClear = useCallback(() => {
    setIsLocked(false);
    setLockedValue(undefined);
    setValue({ text: "", uid: "" } as T);
    onLockedChange?.(false);
  }, [setValue, onLockedChange]);

  if (mode === "edit") {
    return (
      <TextArea
        value={value?.text || ""}
        onChange={(e) => {
          setValue({ text: e.target.value, uid: value?.uid || "" } as T);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            onConfirm?.();
          }
        }}
        fill
        growVertically
        {...(autocompleteProps.placeholder && {
          placeholder: autocompleteProps.placeholder,
        })}
        {...(autocompleteProps.autoFocus && { autoFocus: true })}
        {...(autocompleteProps.disabled && { disabled: true })}
      />
    );
  }

  // Create mode with locked value
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

  // Create mode with autocomplete
  return (
    <AutocompleteInput
      {...autocompleteProps}
      value={value}
      setValue={handleSetValue}
      onConfirm={() => void onConfirm?.()}
      options={options}
    />
  );
};

export default LockableAutocompleteInput;
