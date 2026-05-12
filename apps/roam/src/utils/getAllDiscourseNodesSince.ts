import { type DiscourseNode } from "./getDiscourseNodes";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";
import extractRef from "roamjs-components/util/extractRef";

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

export const getDiscourseNodeTypeWithSettingsBlockNodes = async (
  node: DiscourseNode,
  sinceMs: number,
): Promise<RoamDiscourseNodeData[]> => {
  const firstChildUid = extractRef(node.embeddingRef || "");
  if (!firstChildUid) {
    return [];
  }

  const regex = getDiscourseNodeFormatExpression(node.format);
  const regexPattern = regex.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const queryBlock = `[
      :find ?childString ?nodeUid ?nodeCreateTime ?nodeEditTime ?author_local_id ?author_name ?node-title
      :keys text source_local_id created last_modified author_local_id author_name node_title
      :in $ ?firstChildUid ?since
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

  return (await window.roamAlphaAPI.data.backend.q(
    queryBlock,
    String(firstChildUid),
    sinceMs,
  )) as unknown[] as RoamDiscourseNodeData[];
};

export const getAllDiscourseNodesSince = async (
  since: ISODateString | undefined,
  nodeTypes: DiscourseNode[],
): Promise<RoamDiscourseNodeData[]> => {
  const sinceMs = since ? new Date(since).getTime() : 0;
  if (!nodeTypes.length) {
    return [];
  }

  const typeMatchers = nodeTypes.map((node) => ({
    node,
    regex: getDiscourseNodeFormatExpression(node.format),
  }));
  const regexPattern = typeMatchers
    .map(({ regex }) => `(?:${regex.source})`)
    .join("|")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"');

  const query = `[
    :find ?node-title ?uid ?nodeCreateTime ?nodeEditTime ?author_local_id ?author_name
    :keys text source_local_id created last_modified author_local_id author_name
    :in $ ?since
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

  const allPages = (await window.roamAlphaAPI.data.backend.q(
    query,
    sinceMs,
  )) as unknown[] as RoamDiscourseNodeData[];

  const resultMap = new Map<string, RoamDiscourseNodeData>();
  const blockBackedNodeTypes = nodeTypes.filter((node) =>
    Boolean(extractRef(node.embeddingRef || "")),
  );

  for (const page of allPages) {
    for (const { node, regex } of typeMatchers) {
      if (regex.test(page.text)) {
        if (page.source_local_id) {
          resultMap.set(page.source_local_id, {
            ...page,
            type: node.type,
          });
        }
        break;
      }
    }
  }

  await Promise.all(
    blockBackedNodeTypes.map(async (node) => {
      const blockNodes = await getDiscourseNodeTypeWithSettingsBlockNodes(
        node,
        sinceMs,
      );

      blockNodes.forEach((blockNode) => {
        if (blockNode.source_local_id) {
          resultMap.set(blockNode.source_local_id, {
            ...blockNode,
            type: node.type,
          });
        }
      });
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
