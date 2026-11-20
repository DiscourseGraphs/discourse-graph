import {
  rankDiscourseNodesByTitle,
  type RankedDiscourseNode,
  type SearchableNode,
} from "~/services/QueryEngine";
import type { DiscourseNode } from "~/types";

// Matches Roam's summoning menu.
const MAX_NODES_PER_TYPE = 10;

export type SummonMenuGroup = {
  nodeType: DiscourseNode;
  nodes: RankedDiscourseNode[];
};

export const groupNodesForSummonMenu = ({
  nodes,
  nodeTypes,
  query,
}: {
  nodes: SearchableNode[];
  nodeTypes: DiscourseNode[];
  query: string;
}): SummonMenuGroup[] => {
  const ranked = rankDiscourseNodesByTitle({ candidates: nodes, query });

  return nodeTypes
    .map((nodeType) => ({
      nodeType,
      nodes: ranked
        .filter((node) => node.nodeTypeId === nodeType.id)
        .slice(0, MAX_NODES_PER_TYPE),
    }))
    .filter((group) => group.nodes.length > 0);
};
