import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { crossAppNodeToDbContent } from "@repo/database/lib/crossAppConverters";
import { fullContentNodeToCrossApp } from "./roamToCrossAppConverters";
import type { LocalContentDataInput } from "@repo/database/inputTypes";
import type { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import type { DiscourseNode } from "./getDiscourseNodes";

export type SharedFullContentUpdate = {
  fullContentNode: RoamDiscourseNodeData;
  nodeType: DiscourseNode;
};

/** Paired so the asset stage reuses the markdown rather than rebuilding it from Roam. */
export type ConvertedFullContent = {
  node: CrossAppNode;
  content: LocalContentDataInput;
};

export const convertRoamNodeToFullContent = ({
  nodes,
}: {
  nodes: SharedFullContentUpdate[];
}): ConvertedFullContent[] =>
  nodes.flatMap(({ fullContentNode, nodeType }) => {
    try {
      const crossAppNode = fullContentNodeToCrossApp(fullContentNode, nodeType);
      const fullContent = crossAppNodeToDbContent(crossAppNode, "full");
      return fullContent === undefined
        ? []
        : [{ node: crossAppNode, content: fullContent }];
    } catch (error) {
      console.error(
        `convertRoamNodeToFullContent: failed to build full markdown for ${fullContentNode.source_local_id}:`,
        error,
      );
      return [];
    }
  });
