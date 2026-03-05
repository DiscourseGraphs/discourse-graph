/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Tldraw color names that can be used for relation types.
 * These match the defaultColorNames from tldraw's TLColorStyle.
 */
export const TLDRAW_COLOR_NAMES = [
  "black",
  "grey",
  "light-violet",
  "violet",
  "blue",
  "light-blue",
  "yellow",
  "orange",
  "green",
  "light-green",
  "light-red",
  "red",
  "white",
] as const;

export type TldrawColorName = (typeof TLDRAW_COLOR_NAMES)[number];

/**
 * Human-readable labels for tldraw color names
 */
export const TLDRAW_COLOR_LABELS: Record<TldrawColorName, string> = {
  black: "Black",
  grey: "Grey",
  "light-violet": "Light Violet",
  violet: "Violet",
  blue: "Blue",
  "light-blue": "Light Blue",
  yellow: "Yellow",
  orange: "Orange",
  green: "Green",
  "light-green": "Light Green",
  "light-red": "Light Red",
  red: "Red",
  white: "White",
};

export const DEFAULT_TLDRAW_COLOR: TldrawColorName = "black";

// from @tldraw/editor/editor.css
export const COLOR_PALETTE: Record<string, string> = {
  black: "#1d1d1d",
  blue: "#4263eb",
  green: "#099268",
  grey: "#adb5bd",
  "light-blue": "#4dabf7",
  "light-green": "#40c057",
  "light-red": "#ff8787",
  "light-violet": "#e599f7",
  orange: "#f76707",
  red: "#e03131",
  violet: "#ae3ec9",
  white: "#ffffff",
  yellow: "#ffc078",
};

/**
 * Ensures a color value is a valid TldrawColorName.
 * If the value is already a valid name, returns it directly.
 * If it's a hex value, finds the matching tldraw color.
 * Falls back to DEFAULT_TLDRAW_COLOR if no match is found.
 */
export const toTldrawColor = (color: string | undefined): TldrawColorName => {
  if (!color) return DEFAULT_TLDRAW_COLOR;

  if (TLDRAW_COLOR_NAMES.includes(color as TldrawColorName)) {
    return color as TldrawColorName;
  }

  const hex = color.toLowerCase();
  for (const [name, paletteHex] of Object.entries(COLOR_PALETTE)) {
    if (paletteHex.toLowerCase() === hex) {
      return name as TldrawColorName;
    }
  }

  return DEFAULT_TLDRAW_COLOR;
}
