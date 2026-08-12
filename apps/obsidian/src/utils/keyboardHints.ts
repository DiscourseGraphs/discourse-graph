import { Platform } from "obsidian";

export type HintKey = "Mod" | "Alt" | "Shift" | "Enter" | "Escape";

// Obsidian shows glyphs on macOS and spelled-out words everywhere else, so the
// same shortcut has to render two ways. Roam's search footer hardcoded the macOS
// glyphs per action (ENG-2000) and showed the wrong hint on Windows; routing
// every hint through these maps is what keeps that from repeating here.
const MAC_SYMBOLS: Record<HintKey, string> = {
  Mod: "⌘",
  Alt: "⌥",
  Shift: "⇧",
  Enter: "↵",
  Escape: "esc",
};

const NON_MAC_SYMBOLS: Record<HintKey, string> = {
  Mod: "Ctrl",
  Alt: "Alt",
  Shift: "Shift",
  Enter: "Enter",
  Escape: "Esc",
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
