import React, { useState, useCallback, useMemo, useRef } from "react";
import { OnloadArgs } from "roamjs-components/types";
import {
  InputGroup,
  Button,
  getKeyCombo,
  IKeyCombo,
  Label,
} from "@blueprintjs/core";
import Description from "roamjs-components/components/Description";
import { DISCOURSE_TOOL_SHORTCUT_KEY } from "~/data/userSettings";
import { setPersonalSetting } from "~/components/settings/utils/accessors";
import { comboToString } from "~/components/DiscourseNodeMenu";

type KeyboardShortcutInputProps = {
  onloadArgs: OnloadArgs;
  settingKey: string;
  blockPropKey: string;
  label: string;
  description: string;
  placeholder?: string;
};

const KeyboardShortcutInput = ({
  onloadArgs,
  settingKey,
  blockPropKey,
  label,
  description,
  placeholder = "Click to set shortcut",
}: KeyboardShortcutInputProps) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const inputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [comboKey, setComboKey] = useState<IKeyCombo>(
    () =>
      (extensionAPI.settings.get(settingKey) as IKeyCombo) || {
        modifiers: 0,
        key: "",
      },
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
      // For discourse tool, only allow single keys without modifiers
      if (settingKey === DISCOURSE_TOOL_SHORTCUT_KEY) {
        // Ignore modifier keys
        if (e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) {
          return;
        }

        // Only allow single character keys
        if (e.key.length === 1) {
          const comboObj = { key: e.key.toLowerCase(), modifiers: 0 };
          setComboKey(comboObj);
          extensionAPI.settings
            .set(settingKey, comboObj)
            .catch(() => console.error("Failed to set setting"));
          setPersonalSetting([blockPropKey], comboObj);
        }
        return;
      }

      // For other shortcuts, use the full Blueprint logic
      const comboObj = getKeyCombo(e.nativeEvent);
      if (!comboObj.key) return;

      const combo = { key: comboObj.key, modifiers: comboObj.modifiers };
      setComboKey(combo);
      extensionAPI.settings
        .set(settingKey, combo)
        .catch(() => console.error("Failed to set setting"));
      setPersonalSetting([blockPropKey], combo);
    },
    [extensionAPI, settingKey, blockPropKey],
  );

  const shortcut = useMemo(() => comboToString(comboKey), [comboKey]);

  const handleClear = useCallback(() => {
    const clearedCombo = { modifiers: 0, key: "" };
    setComboKey(clearedCombo);
    extensionAPI.settings
      .set(settingKey, clearedCombo)
      .catch(() => console.error("Failed to set setting"));
    setPersonalSetting([blockPropKey], clearedCombo);
  }, [extensionAPI, settingKey, blockPropKey]);

  return (
    <Label>
      {label}
      <Description description={description} />
      <InputGroup
        inputRef={inputRef}
        placeholder={isActive ? "Press keys" : placeholder}
        value={shortcut}
        onKeyDown={handleKeyDown}
        onFocus={() => setIsActive(true)}
        onBlur={() => setIsActive(false)}
        rightElement={
          <Button
            hidden={!comboKey.key}
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
