import { DiscourseNode } from "~/types";

// Color palette similar to Roam's implementation
const COLOR_PALETTE: Record<string, string> = {
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

const COLOR_ARRAY = [
  "yellow",
  "white",
  "violet",
  "red",
  "orange",
  "lightViolet",
  "lightRed",
  "lightGreen",
  "lightBlue",
  "grey",
  "green",
  "blue",
  "black",
];

/**
 * Format hex color to ensure it starts with #
 */
export const formatHexColor = (color: string): string => {
  if (!color) return "";
  const COLOR_TEST = /^[0-9a-f]{6}$/i;
  const COLOR_TEST_WITH_HASH = /^#[0-9a-f]{6}$/i;
  if (color.startsWith("#")) {
    return COLOR_TEST_WITH_HASH.test(color) ? color : "";
  } else if (COLOR_TEST.test(color)) {
    return "#" + color;
  }
  return "";
};

/**
 * Calculate contrast color (black or white) based on background color
 * Simplified version of contrast-color logic
 */
export const getContrastColor = (bgColor: string): string => {
  // Remove # if present
  const hex = bgColor.replace("#", "");
  
  // Ensure we have a valid hex string
  if (hex.length !== 6) return "#000000";
  
  // Convert to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Check for NaN values
  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#000000";
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  // Return black for light backgrounds, white for dark backgrounds
  return luminance > 0.5 ? "#000000" : "#ffffff";
};

/**
 * Get colors for a discourse node type
 */
export const getDiscourseNodeColors = (nodeType: DiscourseNode, nodeIndex: number): { backgroundColor: string; textColor: string } => {
  // Use custom color from node type if available
  const customColor = nodeType.color ? formatHexColor(nodeType.color) : "";
  
  // Fall back to palette color based on index
  const safeIndex = nodeIndex >= 0 && nodeIndex < COLOR_ARRAY.length ? nodeIndex : 0;
  const paletteColorKey = COLOR_ARRAY[safeIndex];
  const paletteColor = paletteColorKey ? COLOR_PALETTE[paletteColorKey] : COLOR_PALETTE.blue;
  
  const backgroundColor = customColor || paletteColor || "#4263eb";
  const textColor = getContrastColor(backgroundColor);
  
  return { backgroundColor, textColor };
};

/**
 * Get all discourse node colors for CSS variable generation
 */
export const getAllDiscourseNodeColors = (nodeTypes: DiscourseNode[]): Array<{ nodeType: DiscourseNode; colors: { backgroundColor: string; textColor: string } }> => {
  return nodeTypes.map((nodeType, index) => ({
    nodeType,
    colors: getDiscourseNodeColors(nodeType, index),
  }));
};
