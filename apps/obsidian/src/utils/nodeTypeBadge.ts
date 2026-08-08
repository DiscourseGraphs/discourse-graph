import { DiscourseNode } from "~/types";
import { getNodeTagColors } from "./colorUtils";

const BADGE_TEXT_LENGTH = 3;

export type NodeTypeBadge = {
  text: string;
  backgroundColor: string;
  textColor: string;
};

/**
 * Mirrors Roam's `formatBadgeText` so a node type abbreviates to the same three
 * letters in both apps. The tag wins over the name because it is the string
 * users already see on the node itself.
 */
export const formatNodeTypeBadgeText = (source: string): string =>
  source.replace(/^#+/, "").trim().slice(0, BADGE_TEXT_LENGTH).toUpperCase();

/**
 * Reuses the colors the editor already paints discourse tags with, so the same
 * node type reads identically in a tag and in a search result.
 */
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
 * `nodeTypeId` comes from file frontmatter, so it can outlive the node type it
 * names — deleted types and notes imported from another vault both land here.
 */
export const UNKNOWN_NODE_TYPE_BADGE: NodeTypeBadge = {
  text: "?",
  backgroundColor: "var(--background-modifier-hover)",
  textColor: "var(--text-muted)",
};
