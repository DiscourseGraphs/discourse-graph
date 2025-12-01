import { colord } from "colord";
import getPleasingColors from "@repo/utils/getPleasingColors";
import {
  COLOR_ARRAY,
  COLOR_PALETTE,
} from "~/components/canvas/DiscourseNodeUtil";
import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";

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
      discourseNodeIndex >= 0 && discourseNodeIndex < COLOR_ARRAY.length - 1
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
