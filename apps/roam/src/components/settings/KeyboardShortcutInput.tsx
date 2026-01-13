import React, { useState, useCallback, useRef } from "react";
import { InputGroup, Button, Label } from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import {
  getPersonalSetting,
  setPersonalSetting,
} from "./utils/accessors";

type KeyboardShortcutInputProps = {
  label: string;
  description: string;
  settingKey: string;
  placeholder?: string;
};

// Simple keyboard shortcut input for single-key shortcuts (no modifiers)
const KeyboardShortcutInput = ({
  label,
  description,
  settingKey,
  placeholder = "Click to set shortcut",
}: KeyboardShortcutInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [shortcutKey, setShortcutKey] = useState<string>(
    () => getPersonalSetting<string>([settingKey])!,
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Allow focus navigation & cancel without intercepting
      if (e.key === "Tab") return;
      if (e.key === "Escape") {
        inputRef.current?.blur();
        return;
      }
      e.stopPropagation();
      e.preventDefault();

      // Ignore modifier keys
      if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) {
        return;
      }

      // Only allow single character keys
      if (e.key.length === 1) {
        const key = e.key.toLowerCase();
        setShortcutKey(key);
        setPersonalSetting([settingKey], key);
      }
    },
    [settingKey],
  );

  const handleClear = useCallback(() => {
    setShortcutKey("");
    setPersonalSetting([settingKey], "");
  }, [settingKey]);

  return (
    <Label>
      {label}
      <Description description={description} />
      <InputGroup
        inputRef={inputRef}
        placeholder={isActive ? "Press a key" : placeholder}
        value={shortcutKey.toUpperCase()}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        rightElement={
          <Button
            hidden={!shortcutKey}
            icon="remove"
            onClick={handleClear}
            minimal
          />
        }
      />
    </Label>
  );
};

export default KeyboardShortcutInput;
