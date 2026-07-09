import { toMarkdown } from "./pageToMarkdown";
import { type DiscourseNode } from "./getDiscourseNodes";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageViewType from "roamjs-components/queries/getPageViewType";
import type { TreeNode, ViewType } from "roamjs-components/types";
import { contentTypes } from "@repo/content-model";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { crossAppNodeToDbContent } from "@repo/database/lib/crossAppConverters";
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

const FULL_MARKDOWN_OPTS = {
  refs: true,
  embeds: true,
  simplifiedFilename: false,
  removeSpecialCharacters: false,
  maxFilenameLength: 64,
  linkType: "alias",
  allNodes: [] as DiscourseNode[],
};

export const buildFullMarkdown = ({
  title,
  blocks,
  viewType = "bullet",
}: {
  title: string;
  blocks: TreeNode[];
  viewType?: ViewType;
}): string => {
  const body = blocks
    .filter((block) => !!block.text || !!block.children?.length)
    .map((block) =>
      toMarkdown({ c: block, v: viewType, i: 0, opts: FULL_MARKDOWN_OPTS }),
    )
    .join("\n")
    .trim();
  return body ? `# ${title}\n\n${body}\n` : `# ${title}\n`;
};

export const convertRoamNodeToFullContent = ({
  nodes,
}: {
  nodes: RoamFullContentNode[];
}): LocalContentDataInput[] =>
  nodes.flatMap((node) => {
    try {
      const title = node.node_title ?? node.text;
      const blocks = getFullTreeByParentUid(node.source_local_id).children;
      const viewType = getPageViewType(title) || "bullet";
      const crossAppNode: CrossAppNode = {
        author: { localId: node.author_local_id },
        localId: node.source_local_id,
        createdAt: new Date(node.created || Date.now()),
        modifiedAt: new Date(node.last_modified || Date.now()),
        nodeType: { localId: node.node_type_id },
        content: {
          direct: {
            localId: node.source_local_id,
            value: title,
          },
          full: {
            localId: node.source_local_id,
            value: buildFullMarkdown({ title, blocks, viewType }),
            contentType: contentTypes.roamMarkdown,
            scale: "document",
          },
        },
      };
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
