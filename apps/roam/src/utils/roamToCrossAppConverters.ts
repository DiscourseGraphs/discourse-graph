import type {
  CrossAppNode,
  CrossAppNodeSchema,
  CrossAppRelation,
  CrossAppRelationTripleSchema,
} from "@repo/database/crossAppContracts";
import type { DiscourseNode } from "./getDiscourseNodes";
import type { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import type { TreeNode, ViewType } from "roamjs-components/types";
import type { NodeUidWithType } from "~/utils/publishNodesToGroups";
import type { Json } from "@repo/database/dbTypes";
import type { ReifiedRelationDataWithRelId } from "./createReifiedBlock";
import type { DiscourseRelation } from "./getDiscourseRelations";
import { toMarkdown } from "./pageToMarkdown";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageViewType from "roamjs-components/queries/getPageViewType";
import { contentTypes } from "@repo/content-model";
import { templateToText } from "./templateToText";

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

const buildFullInlineContent = ({
  uid,
  title,
}: {
  uid: string;
  title: string;
}): NonNullable<CrossAppNode["content"]["full"]> => {
  const blocks = getFullTreeByParentUid(uid).children;
  const viewType = getPageViewType(title) || "bullet";
  return {
    localId: uid,
    value: buildFullMarkdown({ title, blocks, viewType }),
    contentType: contentTypes.roamMarkdown,
    scale: "document",
  };
};

// A node whose text lives in a first child block below its page (the isFirstChild
// node type setting) is known by its page title followed by that block's text, and
// its direct content is a direct_and_description. A node that is a page holds a
// plain direct: its title. When the first child block is missing, there is no
// description to speak of, and the title alone is left: a plain direct again.
// Known gap: a published isFirstChild node should arguably carry both, so that its
// plain direct is kept up to date alongside the direct_and_description.
const directContent = (
  node: RoamDiscourseNodeData,
): CrossAppNode["content"]["direct"] =>
  node.node_title && node.text
    ? {
        localId: node.source_local_id,
        value: `${node.node_title} ${node.text}`,
        variant: "direct_and_description",
      }
    : {
        localId: node.source_local_id,
        value: node.node_title || node.text,
        variant: "direct",
      };

// The node without its full content: building that content walks the whole page,
// so callers that do not need it should not pay for it.
export const contentNodeToCrossApp = (
  node: RoamDiscourseNodeData,
): CrossAppNode => ({
  authorId: node.author_local_id,
  localId: node.source_local_id,
  createdAt: new Date(node.created || Date.now()),
  modifiedAt: new Date(node.last_modified || Date.now()),
  nodeType: node.type,
  content: {
    direct: directContent(node),
  },
});

export const fullContentNodeToCrossApp = (
  node: RoamDiscourseNodeData,
): CrossAppNode => {
  const crossAppNode = contentNodeToCrossApp(node);
  // the full content is a rendering of the node's page, so it is titled by the page
  crossAppNode.content.full = buildFullInlineContent({
    uid: node.source_local_id,
    title: node.node_title ?? node.text,
  });
  return crossAppNode;
};

export const nodeUidsWithTypeToCrossApp = async (
  nodes: NodeUidWithType[],
): Promise<CrossAppNode[]> => {
  const typesByUid = Object.fromEntries(nodes.map((n) => [n.uid, n.type]));
  const nodeRows = (await window.roamAlphaAPI.data.async.pull_many(
    `[:block/uid :create/user :create/time :edit/time :page/edit-time :node/title]`,
    nodes.map((n) => [":block/uid", n.uid]),
  )) as Record<string, Json>[];
  const userEids = [
    ...new Set(
      nodeRows.map(
        (r) => (r[":create/user"] as Record<string, number>)[":db/id"],
      ),
    ),
  ];
  const userRows = await window.roamAlphaAPI.data.async.pull_many(
    `[:db/id :user/uid]`,
    // @ts-expect-error array of dbIds is valid
    userEids,
  );
  const userUidByEid = Object.fromEntries(
    userRows.map((r) => [r[":db/id"] as number, r[":user/uid"] as string]),
  );
  const results = nodeRows.map((row) => {
    const uid = row[":block/uid"] as string;
    const title = row[":node/title"] as string;
    const userUid =
      userUidByEid[(row[":create/user"] as Record<string, number>)[":db/id"]];
    const createdTime = row[":create/time"] as number;
    const editTime = (row[":edit/time"] as number | undefined) ?? createdTime;
    const pageEditTime =
      (row[":page/edit-time"] as number | undefined) ?? editTime;

    return {
      localId: uid,
      nodeType: typesByUid[uid],
      authorId: userUid,
      createdAt: new Date(createdTime),
      modifiedAt: new Date(Math.max(editTime, pageEditTime)),
      content: {
        direct: {
          localId: uid,
          value: title,
        },
        full: buildFullInlineContent({ uid, title }),
      },
    };
  });
  return results;
};

export const reifiedRelationToCrossApp = (
  r: ReifiedRelationDataWithRelId,
): CrossAppRelation | null => {
  const relData = window.roamAlphaAPI.pull(
    "[:create/time :edit/time {:create/user [:user/uid]}]",
    `[:block/uid "${r.relationId}"]`,
  ) as Record<string, Json>;
  if (relData == undefined || !relData[":create/user"]) return null;
  const userUid = (relData[":create/user"] as Record<string, string>)[
    ":user/uid"
  ];

  return {
    localId: r.relationId,
    relationType: r.hasSchema,
    source: r.sourceUid,
    destination: r.destinationUid,
    authorId: userUid,
    createdAt: new Date(relData[":create/time"] as number),
    modifiedAt: new Date(relData[":edit/time"] as number),
  };
};

export const relationTripleSchemaToCrossApp = (
  r: DiscourseRelation,
): CrossAppRelationTripleSchema | null => {
  const relData = window.roamAlphaAPI.pull(
    "[:create/time :edit/time {:create/user [:user/uid]}]",
    `[:block/uid "${r.id}"]`,
  ) as Record<string, Json>;
  if (!relData) return null;
  const userUid = (relData[":create/user"] as Record<string, string>)[
    ":user/uid"
  ];

  return {
    localId: r.id,
    sourceType: r.source,
    destinationType: r.destination,
    label: r.label,
    complement: r.complement,
    authorId: userUid,
    createdAt: new Date(relData[":create/time"] as number),
    modifiedAt: new Date(relData[":edit/time"] as number),
  };
};

export const nodeSchemaToCrossApp = (
  s: DiscourseNode,
): CrossAppNodeSchema | null => {
  const relData = window.roamAlphaAPI.pull(
    "[:create/time :edit/time {:create/user [:user/uid]}]",
    `[:block/uid "${s.type}"]`,
  ) as unknown as {
    ":create/time": number;
    ":edit/time": number;
    ":create/user": { ":user/uid": string };
  };
  if (!relData) return null;
  const userUid = (relData[":create/user"] ?? {})[":user/uid"];
  if (!userUid) return null;
  const createdTime = relData[":create/time"] || Date.now();
  return {
    localId: s.type,
    label: s.text,
    authorId: userUid,
    createdAt: new Date(createdTime),
    modifiedAt: new Date(relData[":edit/time"] || createdTime),
    ...(s.template?.length ? { template: templateToText(s.template) } : {}),
  };
};
