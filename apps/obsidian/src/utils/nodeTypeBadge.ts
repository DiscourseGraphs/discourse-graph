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

/** For a result published to another space: same muted look as an unresolved type, labeled with the space instead. */
export const getSpaceBadge = (spaceName: string): NodeTypeBadge => ({
  text: spaceName,
  backgroundColor: "var(--background-modifier-hover)",
  textColor: "var(--text-muted)",
});

export const getFallbackNodeTypeBadge = (
  title: string,
): NodeTypeBadge | null => {
  const [prefix, ...rest] = title.split(" - ");
  if (!rest.length || !prefix) return null;

  const text = formatNodeTypeBadgeText(prefix);
  if (!text) return null;

  return {
    text,
    backgroundColor: "var(--background-modifier-hover)",
    textColor: "var(--text-muted)",
  };
};
