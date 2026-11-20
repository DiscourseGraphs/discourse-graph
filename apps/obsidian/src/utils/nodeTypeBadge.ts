import { DiscourseNode } from "~/types";
import { getNodeTagColors } from "./colorUtils";

const BADGE_TEXT_LENGTH = 3;

export type NodeTypeBadge = {
  text: string;
  backgroundColor: string;
  textColor: string;
};

export const formatNodeTypeBadgeText = (source: string): string =>
  source.replace(/^#+/, "").trim().slice(0, BADGE_TEXT_LENGTH).toUpperCase();

export const getNodeTypeBadge = ({
  nodeType,
  nodeIndex,
}: {
  nodeType: DiscourseNode;
  nodeIndex: number;
}): NodeTypeBadge => ({
  text: formatNodeTypeBadgeText(nodeType.tag?.trim() || nodeType.name),
  ...getNodeTagColors(nodeType, nodeIndex),
});
