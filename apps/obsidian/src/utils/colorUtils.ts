import { colord } from "colord";
import getPleasingColors from "@repo/utils/getPleasingColors";
import { DiscourseNode } from "~/types";

// Order matches Roam's COLOR_ARRAY (tldraw's defaultColorNames reversed), so a node
// type without a color gets the same default by index in both apps.
const COLOR_PALETTE: Record<string, string> = {
  white: "#ffffff",
  red: "#e03131",
  lightRed: "#ff8787",
  lightGreen: "#40c057",
  green: "#099268",
  orange: "#f76707",
  yellow: "#ffc078",
  lightBlue: "#4dabf7",
  blue: "#4263eb",
  violet: "#ae3ec9",
  lightViolet: "#e599f7",
  grey: "#adb5bd",
  black: "#1d1d1d",
};

const COLOR_ARRAY = Object.keys(COLOR_PALETTE);

// TODO switch to colord - https://linear.app/discourse-graphs/issue/ENG-836/button-like-css-styling-for-node-tag
export const getContrastColor = (bgColor: string): string => {
  const hex = bgColor.replace("#", "");

  if (hex.length !== 6) return "#000000";

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  if (isNaN(r) || isNaN(g) || isNaN(b)) return "#000000";

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.5 ? "#000000" : "#ffffff";
};

type NodeTagColors = {
  baseColor: string;
  backgroundColor: string;
  textColor: string;
};

// The editor's tag plugin asks for these on every update; the color search is costly.
const pleasingColorCache = new Map<
  string,
  { background: string; text: string }
>();
const getCachedPleasingColors = (
  baseColor: string,
): { background: string; text: string } => {
  const cached = pleasingColorCache.get(baseColor);
  if (cached) return cached;
  const { background, text } = getPleasingColors(colord(baseColor));
  const colors = { background, text };
  pleasingColorCache.set(baseColor, colors);
  return colors;
};

// Same derivation as Roam's getDiscourseNodeColors, so tags match across apps.
export const getNodeTagColors = (
  nodeType: DiscourseNode,
  nodeIndex: number,
): NodeTagColors => {
  const customColor = nodeType.color || "";

  const safeIndex =
    nodeIndex >= 0 && nodeIndex < COLOR_ARRAY.length ? nodeIndex : 0;
  const paletteColorKey = COLOR_ARRAY[safeIndex];
  const paletteColor = paletteColorKey
    ? COLOR_PALETTE[paletteColorKey]
    : COLOR_PALETTE.blue;

  const baseColor = customColor || paletteColor || "#4263eb";
  const { background, text } = getCachedPleasingColors(baseColor);

  return { baseColor, backgroundColor: background, textColor: text };
};

export const getAllDiscourseNodeColors = (
  nodeTypes: DiscourseNode[],
): Array<{
  nodeType: DiscourseNode;
  colors: NodeTagColors;
}> => {
  return nodeTypes.map((nodeType, index) => ({
    nodeType,
    colors: getNodeTagColors(nodeType, index),
  }));
};
