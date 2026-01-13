/**
 * Tldraw color names that can be used for relation types.
 * These match the defaultColorNames from tldraw's TLColorStyle.
 */
export const TLDRAW_COLOR_NAMES = [
  "black",
  "grey",
  "lightViolet",
  "violet",
  "blue",
  "lightBlue",
  "yellow",
  "orange",
  "green",
  "lightGreen",
  "lightRed",
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
  lightViolet: "Light Violet",
  violet: "Violet",
  blue: "Blue",
  lightBlue: "Light Blue",
  yellow: "Yellow",
  orange: "Orange",
  green: "Green",
  lightGreen: "Light Green",
  lightRed: "Light Red",
  red: "Red",
  white: "White",
};

export const DEFAULT_TLDRAW_COLOR: TldrawColorName = "black";

// from @tldraw/editor/editor.css
/* eslint-disable @typescript-eslint/naming-convention */
export const COLOR_PALETTE: Record<string, string> = {
  black: "#1d1d1d",
  blue: "#4263eb",
  green: "#099268",
  grey: "#adb5bd",
  lightBlue: "#4dabf7",
  lightGreen: "#40c057",
  lightRed: "#ff8787",
  lightViolet: "#e599f7",
  orange: "#f76707",
  red: "#e03131",
  violet: "#ae3ec9",
  white: "#ffffff",
  yellow: "#ffc078",
};
