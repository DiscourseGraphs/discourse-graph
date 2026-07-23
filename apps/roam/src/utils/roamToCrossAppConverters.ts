import type { CrossAppNode } from "@repo/database/crossAppContracts";
import type { RoamFullContentNode } from "./convertRoamNodeToFullContent";
import type { DiscourseNode } from "./getDiscourseNodes";
import type { TreeNode, ViewType } from "roamjs-components/types";
import { toMarkdown } from "./pageToMarkdown";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageViewType from "roamjs-components/queries/getPageViewType";
import { contentTypes } from "@repo/content-model";

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

export const fullContentNodeToCrossApp = (
  node: RoamFullContentNode,
): CrossAppNode => {
  const title = node.node_title ?? node.text;
  const blocks = getFullTreeByParentUid(node.source_local_id).children;
  const viewType = getPageViewType(title) || "bullet";
  const fullText = buildFullMarkdown({ title, blocks, viewType });

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
      full: {
        localId: node.source_local_id,
        value: fullText,
        contentType: contentTypes.roamMarkdown,
        scale: "document",
      },
    },
  };
};
