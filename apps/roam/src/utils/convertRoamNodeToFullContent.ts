import { crossAppNodeToDbContent } from "@repo/database/lib/crossAppConverters";
import { fullContentNodeToCrossApp } from "./roamToCrossAppConverters";
import type { LocalContentDataInput } from "@repo/database/inputTypes";

export type RoamFullContentNode = {
  author_local_id: string;
  source_local_id: string;
  created: string | number;
  last_modified: string | number;
  text: string;
  node_type_id: string;
  node_title?: string;
};

export const convertRoamNodeToFullContent = ({
  nodes,
}: {
  nodes: RoamFullContentNode[];
}): LocalContentDataInput[] =>
  nodes.flatMap((node) => {
    try {
      const crossAppNode = fullContentNodeToCrossApp(node);
      const fullContent = crossAppNodeToDbContent(crossAppNode, "full");
      return fullContent === undefined ? [] : [fullContent];
    } catch (error) {
      console.error(
        `convertRoamNodeToFullContent: failed to build full markdown for ${node.source_local_id}:`,
        error,
      );
      return [];
    }
  });
