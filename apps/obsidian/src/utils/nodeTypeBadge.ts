import { DiscourseNode } from "~/types";
import { getNodeTagColors } from "./colorUtils";

const BADGE_TEXT_LENGTH = 3;

export type NodeTypeBadge = {
  text: string;
  backgroundColor: string;
  textColor: string;
};

/**
 * Mirrors Roam's `formatBadgeText`. The tag wins over the name because it is
 * the string users already see on the node.
 */
export const formatNodeTypeBadgeText = (source: string): string =>
  source.replace(/^#+/, "").trim().slice(0, BADGE_TEXT_LENGTH).toUpperCase();

/** Reuses the editor's tag colors so a node type reads the same everywhere. */
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
 * `nodeTypeId` comes from frontmatter, so it can outlive the type it names —
 * a deleted type, or a note imported from a vault configured differently.
 *
 * Roam covers this by storing the type's label on the result when it indexes, and
 * falling back to that. We have no such label, but node formats are
 * `PREFIX - {content}`, so the title still carries the prefix the badge would have
 * shown. Returns null when the title has no prefix either: an abbreviation of the
 * note's own words would say nothing about its type.
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
