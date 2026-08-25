import { describe, expect, it } from "vitest";
import { formatHintKeys, type HintKey } from "~/utils/keyboardHints";

const ALL_KEYS: HintKey[] = ["Mod", "Alt", "Shift", "Enter", "Escape"];

describe("formatHintKeys", () => {
  it("renders the mac glyphs for Mod and Alt on macOS", () => {
    expect(formatHintKeys({ keys: ["Mod", "Alt"], isMac: true })).toEqual([
      { type: "icon", icon: "key-command" },
      { type: "icon", icon: "key-option" },
    ]);
  });

  it("spells out Ctrl and Alt off macOS, where no option glyph applies", () => {
    expect(formatHintKeys({ keys: ["Mod", "Alt"], isMac: false })).toEqual([
      { type: "text", label: "Ctrl" },
      { type: "text", label: "Alt" },
    ]);
  });

  it("keeps the platform-neutral keys as icons everywhere", () => {
    const neutralKeys: HintKey[] = ["Shift", "Enter", "Escape"];
    expect(formatHintKeys({ keys: neutralKeys, isMac: true })).toEqual(
      formatHintKeys({ keys: neutralKeys, isMac: false }),
    );
  });

  it("preserves the order of the requested keys", () => {
    expect(formatHintKeys({ keys: ["Alt", "Enter"], isMac: false })).toEqual([
      { type: "text", label: "Alt" },
      { type: "icon", icon: "key-enter" },
    ]);
  });

  it("maps every key on both platforms", () => {
    for (const isMac of [true, false]) {
      const hints = formatHintKeys({ keys: ALL_KEYS, isMac });
      expect(hints).toHaveLength(ALL_KEYS.length);
      expect(hints.every(Boolean)).toBe(true);
    }
  });
});
