/* eslint-disable @typescript-eslint/naming-convention */
import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";
import findDiscourseNode from "./findDiscourseNode";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";

type ISODateString = string;

export type RoamDiscourseNodeData = {
  author_local_id: string;
  author_name: string;
  source_local_id: string;
  created: string;
  vector: number[];
  last_modified: string;
  text: string;
  type: string;
  node_title?: string;
};

export type DiscourseNodesSinceResult = {
  pageNodes: RoamDiscourseNodeData[];
  blockNodes: RoamDiscourseNodeData[];
};

export const getDiscourseNodeTypeWithSettingsBlockNodes = (
  node: DiscourseNode,
  sinceMs: number,
  extensionAPI: OnloadArgs["extensionAPI"],
): RoamDiscourseNodeData[] => {
  const settingsKey = `discourse-graph-node-rule-${node.type}`;
  const settings = extensionAPI.settings.get(settingsKey) as {
    embeddingRef: string;
    isFirstChild: boolean;
  };
  const regex = getDiscourseNodeFormatExpression(node.format);
  const regexPattern = regex.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const firstChildUid =
    settings.embeddingRef?.match(/\(\((.*?)\)\)/)?.[1] ?? "";
  const queryBlock = `[
      :find ?childString ?nodeUid        ?nodeCreateTime ?nodeEditTime ?author_local_id ?type ?author_name ?node-title
      :keys text         source_local_id created         last_modified author_local_id   type author_name  node_title
      :in $ ?firstChildUid ?type ?since
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
        [(re-find ?title-regex ?node-title)]
        [?node :block/uid ?nodeUid]
        [?node :create/time ?nodeCreateTime]
        [?node :edit/time ?nodeEditTime]
        [?s :block/uid ?firstChildUid]
        [?s :block/string ?firstChildString]
        [?bg :block/page ?node]
        [?bg :block/string ?firstChildString]
        [?bg :block/children ?child]
        [?child :block/order 0]
        [?child :block/string ?childString]
        [?child :edit/time ?childEditTime]
        [?child :create/user ?user-eid]
        [?user-eid :user/uid ?author_local_id]
        [?child :edit/user ?eu]
        [?eu :user/display-name ?author_name]
        [or 
         [(> ?childEditTime ?since)]
         [(> ?nodeEditTime ?since)]]
        ]`;

  const blockNode = window.roamAlphaAPI.data.q(
    queryBlock,
    String(firstChildUid),
    String(node.type),
    sinceMs,
  ) as unknown as Omit<RoamDiscourseNodeData, "vector">[];
  return blockNode.map((node) => ({ ...node, vector: [] }));
};

export const getAllDiscourseNodesSince = async (
  since: ISODateString,
  nodeTypes: DiscourseNode[],
  extensionAPI: OnloadArgs["extensionAPI"],
): Promise<RoamDiscourseNodeData[]> => {
  const sinceMs = new Date(since).getTime();
  const result: RoamDiscourseNodeData[] = [];

  if (nodeTypes.length > 0) {
    for (const node of nodeTypes) {
      const blockNode = getDiscourseNodeTypeWithSettingsBlockNodes(
        node,
        sinceMs,
        extensionAPI,
      );
      if (blockNode) {
        result.push(...blockNode);
      }
    }
  }

  const query = `[
  :find ?node-title ?uid ?nodeCreateTime ?nodeEditTime ?author_local_id ?author_name
  :keys text source_local_id created last_modified author_local_id author_name
  :in $ ?since 
  :where
    [?node :node/title ?node-title]
    [?node :block/uid ?uid]
    [?node :create/time ?nodeCreateTime]
    [?node :edit/time ?nodeEditTime]
    [?node :create/user ?user-eid]
    [?user-eid :user/uid ?author_local_id]
    [?node :edit/user ?eu]
    [(get-else $ ?eu :user/display-name "Unknown-person") ?author_name]
    [(> ?nodeEditTime ?since)]
]`;

  //@ts-ignore - backend to be added to roamjs-components
  const allNodes = (await window.roamAlphaAPI.data.backend.q(
    query,
    sinceMs,
  )) as unknown as RoamDiscourseNodeData[];

  const discourseNodes = getDiscourseNodes();
  const nodeTypesSet = new Set(nodeTypes.map((nodeType) => nodeType.type));

  result.push(
    ...allNodes
      .map((entity) => {
        if (!entity.source_local_id) {
          return null;
        }
        const node = findDiscourseNode(entity.source_local_id, discourseNodes);
        if (
          !node ||
          node.backedBy === "default" ||
          !entity.text ||
          entity.text.trim() === "" ||
          nodeTypesSet.has(node.type)
        ) {
          return null;
        }
        return {
          ...entity,
          type: node.type,
        };
      })
      .filter((n): n is RoamDiscourseNodeData => n !== null),
  );
  return result;
};

export const nodeTypeSince = async (
  since: ISODateString,
  nodeTypes: DiscourseNode[],
) => {
  const sinceMs = new Date(since).getTime();
  const filterMap = await Promise.all(
    nodeTypes.map((node) => {
      const query = `
      [:find ?node-title
       :in $ ?since ?type
       :where
        [?node :block/uid ?type]
        [?node :node/title ?node-title]
        [?node :edit/time ?nodeEditTime]
        [(> ?nodeEditTime ?since)]]
    `;
      const result = window.roamAlphaAPI.data.q(query, sinceMs, node.type);
      return result.length > 0;
    }),
  );

  const nodesSince = nodeTypes.filter((_, index) => filterMap[index]);
  return nodesSince;
};
