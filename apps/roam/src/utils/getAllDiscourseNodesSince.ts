import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import findDiscourseNode from "./findDiscourseNode";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";
import { extractRef } from "roamjs-components/util";

type ISODateString = string;

/* eslint-disable @typescript-eslint/naming-convention */
export type RoamDiscourseNodeData = {
  author_local_id: string;
  author_name: string;
  source_local_id: string;
  created: string;
  last_modified: string;
  text: string;
  type: string;
  node_title?: string;
};
/* eslint-enable @typescript-eslint/naming-convention */

export type DiscourseNodesSinceResult = {
  pageNodes: RoamDiscourseNodeData[];
  blockNodes: RoamDiscourseNodeData[];
};

export const getDiscourseNodeTypeWithSettingsBlockNodes = (
  node: DiscourseNode,
  sinceMs: number,
): RoamDiscourseNodeData[] => {
  const regex = getDiscourseNodeFormatExpression(node.format);
  const regexPattern = regex.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const firstChildUid = extractRef(node.embeddingRef);
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
  ) as unknown as RoamDiscourseNodeData[];
  return blockNode;
};

export const getAllDiscourseNodesSince = async (
  since: ISODateString,
  nodeTypes: DiscourseNode[],
): Promise<RoamDiscourseNodeData[]> => {
  const sinceMs = new Date(since).getTime();
  const result: RoamDiscourseNodeData[] = [];

  const query = `[

    :find ?node-title ?uid ?nodeCreateTime ?nodeEditTime ?author_local_id ?author_name
    :keys text source_local_id created last_modified author_local_id author_name
    :in $ ?since 
    :where
      [?node :node/title ?node-title]
      [?node :block/uid ?uid]
      [?node :create/time ?nodeCreateTime]
      [?node :create/user ?user-eid]
      [?user-eid :user/uid ?author_local_id]
      [(get-else $ ?user-eid :user/display-name "Unknown-Creator") ?author_name]
      [(get-else $ ?node :edit/time 0) ?nodeEditTime]
      [(get-else $ ?node :edit/time ?nodeCreateTime) ?filterTime]
      [(> ?filterTime ?since)]
  ]`;
  const allNodes = (await Promise.resolve(
    window.roamAlphaAPI.data.backend.q(query, sinceMs),
  )) as unknown as RoamDiscourseNodeData[];

  const discourseNodes = getDiscourseNodes();

  result.push(
    ...allNodes.flatMap((entity) => {
      if (!entity.source_local_id) {
        return [];
      }
      const node = findDiscourseNode(entity.source_local_id, discourseNodes);
      if (
        !node ||
        node.backedBy === "default" ||
        !entity.text ||
        entity.text.trim() === ""
      ) {
        return [];
      }
      return [
        {
          ...entity,
          type: node.type,
        },
      ];
    }),
  );

  if (nodeTypes.length > 0) {
    for (const node of nodeTypes) {
      const blockNode = getDiscourseNodeTypeWithSettingsBlockNodes(
        node,
        sinceMs,
      );
      if (blockNode) {
        result.push(...blockNode);
      }
    }
  }
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
