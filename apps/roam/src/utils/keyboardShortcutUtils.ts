import { IKeyCombo } from "@blueprintjs/core";

/**
 * Convert Blueprint IKeyCombo to tldraw keyboard shortcut format
 *
 * tldraw format examples:
 * - "?C" = Ctrl+C
 * - "$!X" = Shift+Ctrl+X
 * - "!3" = F3
 * - "^A" = Alt+A
 * - "@S" = Cmd+S (Mac) / Win+S (Windows)
 */
export const convertComboToTldrawFormat = (
  combo: IKeyCombo | undefined,
): string => {
  if (!combo || !combo.key) return "";

  const modifiers = [];
  if (combo.modifiers & 2) modifiers.push("?"); // Ctrl
  if (combo.modifiers & 8) modifiers.push("$"); // Shift
  if (combo.modifiers & 1) modifiers.push("^"); // Alt
  if (combo.modifiers & 4) modifiers.push("@"); // Meta/Cmd

  return modifiers.join("") + combo.key.toUpperCase();
};

/**
 * Convert tldraw keyboard shortcut format to Blueprint IKeyCombo
 * This is useful for testing and validation
 */
export const convertTldrawFormatToCombo = (shortcut: string): IKeyCombo => {
  if (!shortcut) return { modifiers: 0, key: "" };

  let modifiers = 0;
  let key = shortcut;

  // Extract modifiers
  if (shortcut.includes("?")) {
    modifiers |= 2; // Ctrl
    key = key.replace("?", "");
  }
  if (shortcut.includes("$")) {
    modifiers |= 8; // Shift
    key = key.replace("$", "");
  }
  if (shortcut.includes("^")) {
    modifiers |= 1; // Alt
    key = key.replace("^", "");
  }
  if (shortcut.includes("@")) {
    modifiers |= 4; // Meta/Cmd
    key = key.replace("@", "");
  }

  return { modifiers, key: key.toLowerCase() };
};
