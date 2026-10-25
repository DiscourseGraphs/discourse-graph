import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { crossAppNodeToDbContent } from "@repo/database/lib/crossAppConverters";
import { fullContentNodeToCrossApp } from "./roamToCrossAppConverters";
import type { LocalContentDataInput } from "@repo/database/inputTypes";
import type { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import type { DiscourseNode } from "./getDiscourseNodes";

/** Paired so the asset stage reuses the markdown rather than rebuilding it from Roam. */
export type ConvertedFullContent = {
  node: CrossAppNode;
  content: LocalContentDataInput;
};

export const convertRoamNodeToFullContent = ({
  nodes,
  nodeTypes,
}: {
  nodes: RoamDiscourseNodeData[];
  nodeTypes: DiscourseNode[];
}): ConvertedFullContent[] =>
  nodes.flatMap((node) => {
    try {
      const crossAppNode = fullContentNodeToCrossApp(
        node,
        nodeTypes.find((nodeType) => nodeType.type === node.type),
      );
      const fullContent = crossAppNodeToDbContent(crossAppNode, "full");
      return fullContent === undefined
        ? []
        : [{ node: crossAppNode, content: fullContent }];
    } catch (error) {
      console.error(
        `convertRoamNodeToFullContent: failed to build full markdown for ${node.source_local_id}:`,
        error,
      );
      return [];
    }
  });
