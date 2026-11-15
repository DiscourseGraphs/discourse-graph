import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { fullContentNodeToCrossApp } from "./roamToCrossAppConverters";
import type { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import type { DiscourseNode } from "./getDiscourseNodes";

export type SharedFullContentUpdate = {
  fullContentNode: RoamDiscourseNodeData;
  nodeType: DiscourseNode;
};

export const convertRoamNodeToFullContent = ({
  nodes,
}: {
  nodes: SharedFullContentUpdate[];
}): CrossAppNode[] =>
  nodes.flatMap(({ fullContentNode, nodeType }) => {
    try {
      return [fullContentNodeToCrossApp(fullContentNode, nodeType)];
    } catch (error) {
      console.error(
        `convertRoamNodeToFullContent: failed to build full markdown for ${fullContentNode.source_local_id}:`,
        error,
      );
      return [];
    }
  });
