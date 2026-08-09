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

/** `nodeTypeId` comes from frontmatter, so it can outlive the type it names. */
export const UNKNOWN_NODE_TYPE_BADGE: NodeTypeBadge = {
  text: "?",
  backgroundColor: "var(--background-modifier-hover)",
  textColor: "var(--text-muted)",
};
