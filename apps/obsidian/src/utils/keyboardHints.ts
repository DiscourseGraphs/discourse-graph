import { Platform } from "obsidian";
import type { KeyboardEvent } from "react";

export type HintKey = "Mod" | "Alt" | "Shift" | "Enter" | "Escape" | "Tab";

// Obsidian shows glyphs on macOS and spelled-out words everywhere else.
const MAC_SYMBOLS: Record<HintKey, string> = {
  Mod: "⌘",
  Alt: "⌥",
  Shift: "⇧",
  Enter: "↵",
  Escape: "esc",
  Tab: "⇥",
};

const NON_MAC_SYMBOLS: Record<HintKey, string> = {
  Mod: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Enter: "Enter",
  Escape: "Esc",
  Tab: "Tab",
};

/** Takes `isMacOS` so the non-mac branch can be checked without that platform. */
export const formatHintKeys = ({
  keys,
  isMacOS,
}: {
  keys: HintKey[];
  isMacOS: boolean;
}): string[] =>
  keys.map((key) => (isMacOS ? MAC_SYMBOLS : NON_MAC_SYMBOLS)[key]);

export const getHintKeys = (keys: HintKey[]): string[] =>
  formatHintKeys({ keys, isMacOS: Platform.isMacOS });

// Rows are divs, so Enter and Space have to be wired up the way a button gets them free.
export const activateOnKey = (
  event: KeyboardEvent<HTMLDivElement>,
  activate: () => void,
): void => {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
};
