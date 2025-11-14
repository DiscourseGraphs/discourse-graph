import { type DiscourseNode } from "./getDiscourseNodes";
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

export const getDiscourseNodeTypeWithSettingsBlockNodes = async (
  node: DiscourseNode,
  sinceMs: number,
): Promise<RoamDiscourseNodeData[]> => {
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
        [(get-else $ ?node :edit/time ?nodeCreateTime) ?nodeEditTime]
        [?s :block/uid ?firstChildUid]
        [?s :block/string ?firstChildString]
        [?bg :block/page ?node]
        [?bg :block/string ?firstChildString]
        [?bg :block/children ?child]
        [?child :block/order 0]
        [?child :block/string ?childString]
        [(get-else $ ?child :edit/time ?nodeCreateTime) ?childEditTime]
        [?child :create/user ?user-eid]
        [?user-eid :user/uid ?author_local_id]
        [(get-else $ ?child :edit/user ?user-eid) ?eu]
        [(get-else $ ?eu :user/display-name "Anonymous User") ?author_name]
        [or 
         [(> ?childEditTime ?since)]
         [(> ?nodeEditTime ?since)]]
        ]`;

  const blockNode = (await Promise.resolve(
    window.roamAlphaAPI.data.backend.q(
      queryBlock,
      String(firstChildUid),
      String(node.type),
      sinceMs,
    ),
  )) as unknown as RoamDiscourseNodeData[];
  return blockNode;
};

export const getAllDiscourseNodesSince = async (
  since: ISODateString,
  nodeTypes: DiscourseNode[],
): Promise<RoamDiscourseNodeData[]> => {
  const sinceMs = new Date(since).getTime();
  const resultMap = new Map<string, RoamDiscourseNodeData>();

  await Promise.all(
    nodeTypes.map(async (node) => {
      const regex = getDiscourseNodeFormatExpression(node.format);
      const regexPattern = regex.source
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');

      const query = `[
        :find ?node-title ?uid ?nodeCreateTime ?nodeEditTime ?author_local_id ?author_name ?type
        :keys text source_local_id created last_modified author_local_id author_name type
        :in $ ?since ?type
        :where
          [(re-pattern "${regexPattern}") ?title-regex]
          [?node :node/title ?node-title]
          [(re-find ?title-regex ?node-title)]
          [?node :block/uid ?uid]
          [?node :create/time ?nodeCreateTime]
          [?node :create/user ?user-eid]
          [?user-eid :user/uid ?author_local_id]
          [(get-else $ ?user-eid :user/display-name "Anonymous User") ?author_name]
          [(get-else $ ?node :edit/time ?nodeCreateTime) ?nodeEditTime]
          [(> ?nodeEditTime ?since)]
      ]`;

      const nodesOfType = (await Promise.resolve(
        window.roamAlphaAPI.data.backend.q(query, sinceMs, String(node.type)),
      )) as unknown as RoamDiscourseNodeData[];

      nodesOfType.forEach((n) => {
        if (n.source_local_id) {
          resultMap.set(n.source_local_id, n);
        }
      });

      const hasBlockSettings =
        node.embeddingRef && extractRef(node.embeddingRef);
      if (hasBlockSettings) {
        const blockNodes = await getDiscourseNodeTypeWithSettingsBlockNodes(
          node,
          sinceMs,
        );
        if (blockNodes) {
          blockNodes.forEach((blockNode) => {
            if (blockNode.source_local_id) {
              resultMap.set(blockNode.source_local_id, blockNode);
            }
          });
        }
      }
    }),
  );
  return Array.from(resultMap.values());
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
