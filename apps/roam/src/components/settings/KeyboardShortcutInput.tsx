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

type KeyboardShortcutInputProps = {
  onloadArgs: OnloadArgs;
  settingKey: string;
  label: string;
  description: string;
  placeholder?: string;
};

// Reuse the keyboard combo utilities from NodeMenuTriggerComponent
const isMac = () => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : undefined;
  return platform == null ? false : /Mac|iPod|iPhone|iPad/.test(platform);
};

const MODIFIER_BIT_MASKS = {
  alt: 1,
  ctrl: 2,
  meta: 4,
  shift: 8,
};

const ALIASES: { [key: string]: string } = {
  cmd: "meta",
  command: "meta",
  escape: "esc",
  minus: "-",
  mod: isMac() ? "meta" : "ctrl",
  option: "alt",
  plus: "+",
  return: "enter",
  win: "meta",
};

const normalizeKeyCombo = (combo: string) => {
  const keys = combo.replace(/\s/g, "").split("+");
  return keys.map((key) => {
    const keyName = ALIASES[key] != null ? ALIASES[key] : key;
    return keyName === "meta" ? (isMac() ? "cmd" : "win") : keyName;
  });
};

const getModifiersFromCombo = (comboKey: IKeyCombo) => {
  if (!comboKey) return [];
  return [
    comboKey.modifiers & MODIFIER_BIT_MASKS.alt && "alt",
    comboKey.modifiers & MODIFIER_BIT_MASKS.ctrl && "ctrl",
    comboKey.modifiers & MODIFIER_BIT_MASKS.shift && "shift",
    comboKey.modifiers & MODIFIER_BIT_MASKS.meta && "meta",
  ].filter(Boolean);
};

const KeyboardShortcutInput = ({
  onloadArgs,
  settingKey,
  label,
  description,
  placeholder = "Click to set shortcut...",
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
        }
        return;
      }

      // For other shortcuts, use the full Blueprint logic
      const comboObj = getKeyCombo(e.nativeEvent);
      if (!comboObj.key) return;

      setComboKey({ key: comboObj.key, modifiers: comboObj.modifiers });
      extensionAPI.settings
        .set(settingKey, comboObj)
        .catch(() => console.error("Failed to set setting"));
    },
    [extensionAPI, settingKey],
  );

  const shortcut = useMemo(() => {
    if (!comboKey.key) return "";

    const modifiers = getModifiersFromCombo(comboKey);
    const comboString = [...modifiers, comboKey.key].join("+");
    return normalizeKeyCombo(comboString).join("+");
  }, [comboKey]);

  const handleClear = useCallback(() => {
    setComboKey({ modifiers: 0, key: "" });
    extensionAPI.settings
      .set(settingKey, "")
      .catch(() => console.error("Failed to set setting"));
  }, [extensionAPI, settingKey]);

  return (
    <Label>
      {label}
      <Description description={description} />
      <InputGroup
        inputRef={inputRef}
        placeholder={isActive ? "Press keys ..." : placeholder}
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
