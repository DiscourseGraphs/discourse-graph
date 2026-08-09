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

/**
 * Mirrors Roam, which stores each node type's label on the search result at index
 * time and falls back to it when the type can no longer be resolved. We have no
 * stored label, but node formats are `PREFIX - {content}`, so the title still
 * carries the prefix the badge would have shown. Null when it does not: an
 * abbreviation of the note's own words would say nothing about its type.
 */
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
