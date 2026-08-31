import { crossAppNodeToDbContent } from "@repo/database/lib/crossAppConverters";
import {
  buildCanonicalRoamDocument,
  fullContentNodeToCrossApp,
} from "./roamToCrossAppConverters";
import type { LocalContentDataInput } from "@repo/database/inputTypes";
import type { Json } from "@repo/database/dbTypes";
import { contentTypes, dgDocumentToPlainText } from "@repo/content-model";

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
      if (fullContent === undefined) return [];
      const document = buildCanonicalRoamDocument({
        uid: node.source_local_id,
        title: node.node_title ?? node.text,
      });
      return [
        fullContent,
        {
          ...fullContent,
          text: dgDocumentToPlainText({ document }),
          content_type: contentTypes.discourseGraphAtJson,
          metadata: { content: document as unknown as Json },
          original: false,
        },
      ];
    } catch (error) {
      console.error(
        `convertRoamNodeToFullContent: failed to build full markdown for ${node.source_local_id}:`,
        error,
      );
      return [];
    }
  });
