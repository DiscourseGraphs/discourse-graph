import { CSSProperties } from "react";
import { colord } from "colord";
import getPleasingColors from "@repo/utils/getPleasingColors";
import {
  COLOR_ARRAY,
  COLOR_PALETTE,
} from "~/components/canvas/DiscourseNodeUtil";
import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";

type GetDiscourseNodeColorsParams = {
  nodeType?: string;
  discourseNodes?: DiscourseNode[];
};

export const getDiscourseNodeColors = ({
  nodeType,
  discourseNodes = getDiscourseNodes(),
}: GetDiscourseNodeColorsParams): {
  backgroundColor: string;
  textColor: string;
} => {
  const discourseNodeIndex =
    discourseNodes.findIndex((node) => node.type === nodeType) ?? -1;
  const color = discourseNodes[discourseNodeIndex]?.canvasSettings?.color ?? "";

  const paletteColor =
    COLOR_ARRAY[
      discourseNodeIndex >= 0 && discourseNodeIndex < COLOR_ARRAY.length
        ? discourseNodeIndex
        : 0
    ];
  const formattedTextColor =
    color && !color.startsWith("#") ? `#${color}` : color;

  const canvasSelectedColor = formattedTextColor
    ? formattedTextColor
    : COLOR_PALETTE[paletteColor];
  const pleasingColors = getPleasingColors(colord(canvasSelectedColor));
  const backgroundColor = pleasingColors.background;
  const textColor = pleasingColors.text;
  return { backgroundColor, textColor };
};

export const getNodeTagStyles = (color: string): CSSProperties | undefined => {
  const formattedColor = formatHexColor(color);
  if (!formattedColor) return undefined;
  const { background, text, border } = getPleasingColors(
    colord(formattedColor),
  );
  return {
    backgroundColor: background,
    color: text,
    border: `1px solid ${border}`,
    fontWeight: "500",
    padding: "2px 6px",
    borderRadius: "12px",
    margin: "0 2px",
    fontSize: "0.9em",
    whiteSpace: "nowrap",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
    display: "inline-block",
    cursor: "pointer",
  };
};
