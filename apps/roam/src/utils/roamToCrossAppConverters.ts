import type {
  CrossAppNode,
  CrossAppNodeSchema,
  CrossAppRelation,
  CrossAppRelationTripleSchema,
} from "@repo/database/crossAppContracts";
import type { RoamFullContentNode } from "./convertRoamNodeToFullContent";
import type { DiscourseNode } from "./getDiscourseNodes";
import type { TreeNode, ViewType } from "roamjs-components/types";
import type { NodeUidWithType } from "~/utils/publishNodesToGroups";
import type { Json } from "@repo/database/dbTypes";
import type { ReifiedRelationDataWithRelId } from "./createReifiedBlock";
import type { DiscourseRelation } from "./getDiscourseRelations";
import { toMarkdown } from "./pageToMarkdown";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import getPageViewType from "roamjs-components/queries/getPageViewType";
import { contentTypes } from "@repo/content-model";
import getDiscourseNodes from "./getDiscourseNodes";
import extractContentFromTitle from "./extractContentFromTitle";
import {
  SOURCE_SLOT,
  schemaHasSourceSlot,
  sourceSlotSchemaId,
  sourceUidOfNode,
} from "./sourceSlot";

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

export const fullContentNodeToCrossApp = (
  node: RoamFullContentNode,
): CrossAppNode => {
  const title = node.node_title ?? node.text;

  return {
    authorId: node.author_local_id,
    localId: node.source_local_id,
    createdAt: new Date(node.created || Date.now()),
    modifiedAt: new Date(node.last_modified || Date.now()),
    nodeType: node.node_type_id,
    coreTitle: extractContentFromTitle(title, { format: node.format }),
    content: {
      direct: {
        localId: node.source_local_id,
        value: title,
      },
      full: buildFullInlineContent({ uid: node.source_local_id, title }),
    },
  };
};

export const nodeUidsWithTypeToCrossApp = async (
  nodes: NodeUidWithType[],
): Promise<CrossAppNode[]> => {
  const typesByUid = Object.fromEntries(nodes.map((n) => [n.uid, n.type]));
  const schemasById = Object.fromEntries(
    getDiscourseNodes().map((s) => [s.type, s]),
  );
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
    const nodeType = typesByUid[uid];
    const sourceUid = sourceUidOfNode(title, schemasById[nodeType]);

    return {
      localId: uid,
      nodeType,
      authorId: userUid,
      createdAt: new Date(createdTime),
      modifiedAt: new Date(Math.max(editTime, pageEditTime)),
      coreTitle: extractContentFromTitle(title, {
        format: schemasById[nodeType]?.format ?? "",
      }),
      content: {
        direct: {
          localId: uid,
          value: title,
        },
        full: buildFullInlineContent({ uid, title }),
      },
      ...(sourceUid ? { slots: { [SOURCE_SLOT]: sourceUid } } : {}),
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
    "[:create/time :page/edit-time {:create/user [:user/uid]}]",
    `[:block/uid "${s.type}"]`,
  ) as unknown as {
    ":create/time": number;
    ":page/edit-time"?: number;
    ":create/user": { ":user/uid": string };
  };
  if (!relData) return null;
  const userUid = (relData[":create/user"] ?? {})[":user/uid"];
  if (!userUid) return null;
  const createdTime = relData[":create/time"] || Date.now();
  // A node type's settings live either in the page's props or in blocks below it,
  // but :page/edit-time reflects both.
  const pageEditTime = relData[":page/edit-time"] || createdTime;
  const hasSourceSlot = schemaHasSourceSlot(s);

  return {
    localId: s.type,
    label: s.text,
    authorId: userUid,
    createdAt: new Date(createdTime),
    modifiedAt: new Date(Math.max(pageEditTime, createdTime)),
    format: s.format,
    ...(hasSourceSlot
      ? { slotDefinitions: { [SOURCE_SLOT]: sourceSlotSchemaId() } }
      : {}),
  };
};
