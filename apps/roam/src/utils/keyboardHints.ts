import type { IconName } from "@blueprintjs/core";
import { isMacOS } from "~/utils/platform";

export type HintKey = "Mod" | "Alt" | "Shift" | "Enter" | "Escape";

// Blueprint has no key-alt icon, so off mac these keys have to render as text.
export type KeyHint =
  | { type: "icon"; icon: IconName }
  | { type: "text"; label: string };

const MAC_HINTS: Record<HintKey, KeyHint> = {
  Mod: { type: "icon", icon: "key-command" },
  Alt: { type: "icon", icon: "key-option" },
  Shift: { type: "icon", icon: "key-shift" },
  Enter: { type: "icon", icon: "key-enter" },
  Escape: { type: "icon", icon: "key-escape" },
};

// Only Mod and Alt are mac-specific; the rest are platform-neutral glyphs that
// Roam itself keeps as icons everywhere.
const NON_MAC_HINTS: Record<HintKey, KeyHint> = {
  Mod: { type: "text", label: "Ctrl" },
  Alt: { type: "text", label: "Alt" },
  Shift: { type: "icon", icon: "key-shift" },
  Enter: { type: "icon", icon: "key-enter" },
  Escape: { type: "icon", icon: "key-escape" },
};

/** Takes `isMac` so the non-mac branch can be checked without that platform. */
export const formatHintKeys = ({
  keys,
  isMac,
}: {
  keys: HintKey[];
  isMac: boolean;
}): KeyHint[] => keys.map((key) => (isMac ? MAC_HINTS : NON_MAC_HINTS)[key]);

export const getHintKeys = (keys: HintKey[]): KeyHint[] =>
  formatHintKeys({ keys, isMac: isMacOS() });
