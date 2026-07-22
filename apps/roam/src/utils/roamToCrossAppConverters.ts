import type { CrossAppNode } from "@repo/database/crossAppContracts";
import type { RoamFullContentNode } from "./convertRoamNodeToFullContent";
import { contentTypes } from "@repo/content-model";

export const fullContentNodeToCrossApp = (
  node: RoamFullContentNode,
): CrossAppNode => {
  return {
    authorId: node.author_local_id,
    localId: node.source_local_id,
    createdAt: new Date(node.created || Date.now()),
    modifiedAt: new Date(node.last_modified || Date.now()),
    nodeType: node.node_type_id,
    content: {
      direct: {
        localId: node.source_local_id,
        value: node.node_title ?? node.text,
      },
      full: node.fullText
        ? {
            localId: node.source_local_id,
            value: node.fullText,
            contentType: contentTypes.roamMarkdown,
            scale: "document",
          }
        : undefined,
    },
  };
};
