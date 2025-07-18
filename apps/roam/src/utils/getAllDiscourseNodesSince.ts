import getDiscourseNodes, {
  DiscourseNode,
  excludeDefaultNodes,
} from "./getDiscourseNodes";
import findDiscourseNode from "./findDiscourseNode";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";

type ISODateString = string;

export type RoamDiscourseNodeData = {
  author_local_id: string;
  author_name: string;
  source_local_id: string;
  document_local_id?: string;
  created: string;
  vector: number[];
  last_modified: string;
  text: string;
  type: string;
};

const getQuery = async (
  node: DiscourseNode,
  sinceMs: number,
  extensionAPI: OnloadArgs["extensionAPI"],
): Promise<DiscourseNodesSinceResult> => {
  const settingsKey = `discourse-graph-node-rule-${node.type}`;
  const settings = extensionAPI.settings.get(settingsKey) as {
    embeddingRef: string;
    isFirstChild: boolean;
  };
  const regex = getDiscourseNodeFormatExpression(node.format);
  const regexPattern = regex.source.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const pageNodes: RoamDiscourseNodeData[] = [];
  const blockNodes: RoamDiscourseNodeData[] = [];
  const query = `[
        :find ?node-title ?uid ?nodeCreateTime ?nodeEditTime ?author_local_id ?type ?author_name
        :keys text source_local_id created last_modified author_local_id type author_name
        :in $ ?since ?type
        :where
          [(re-pattern "${regexPattern}") ?title-regex]
          [?node :node/title ?node-title]
          [(re-find ?title-regex ?node-title)]
          [?node :block/uid ?uid]
          [?node :create/time ?nodeCreateTime]
          [?node :edit/time ?nodeEditTime]
          [?node :edit/user ?eu]
          [?eu :user/display-name ?author_name]
          [?node :create/user ?user-eid]
          [?user-eid :user/uid ?author_local_id]
          [(> ?nodeEditTime ?since)]
          ]`;
  // @ts-ignore - backend to be added to roamjs-components
  const resultPage = (await window.roamAlphaAPI.q(
    query,
    sinceMs,
    node.type,
  )) as unknown as RoamDiscourseNodeData[];
  pageNodes.push(...resultPage);

  if (settings && settings.isFirstChild) {
    const firstChildUid =
      settings.embeddingRef?.match(/\(\((.*?)\)\)/)?.[1] ?? "";
    const queryBlock = `[
      :find ?childUid ?childString ?nodeUid ?childCreateTime ?childEditTime ?author_local_id ?type ?author_name
      :keys source_local_id text document_local_id created last_modified author_local_id type author_name
      :in $ ?firstChildUid ?type ?since
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
        [(re-find ?title-regex ?node-title)]
        [?node :block/uid ?nodeUid]
        [?s :block/uid ?firstChildUid]
        [?s :block/string ?firstChildString]
        [?bg :block/page ?node]
        [?node :node/title ?tit]
        [?bg :block/string ?firstChildString]
        [?bg :block/children ?child]
        [?child :block/order 0]
        [?child :block/uid ?childUid]
        [?child :block/string ?childString]
        [?child :create/time ?childCreateTime]
        [?child :edit/time ?childEditTime]
        [?child :create/user ?user-eid]
        [?user-eid :user/uid ?author_local_id]
        [?child :edit/user ?eu]
        [?eu :user/display-name ?author_name]
        ]`;

    // @ts-ignore - backend to be added to roamjs-components
    const resultBlock = (await window.roamAlphaAPI.q(
      queryBlock,
      String(firstChildUid),
      String(node.type),
      sinceMs,
    )) as unknown as RoamDiscourseNodeData[];
    blockNodes.push(...resultBlock);
  }

  return { pageNodes, blockNodes };
};
export type DiscourseNodesSinceResult = {
  pageNodes: RoamDiscourseNodeData[];
  blockNodes: RoamDiscourseNodeData[];
};

export const getAllDiscourseNodesSince = async (
  extensionAPI: OnloadArgs["extensionAPI"],
  since: ISODateString,
): Promise<DiscourseNodesSinceResult> => {
  const nodeTypes = getDiscourseNodes().filter(excludeDefaultNodes);
  const sinceMs = new Date(since).getTime();

  const pageNodes: RoamDiscourseNodeData[] = [];
  const blockNodes: RoamDiscourseNodeData[] = [];

  for (const node of nodeTypes) {
    const { pageNodes: p, blockNodes: b } = await getQuery(
      node,
      sinceMs,
      extensionAPI,
    );
    pageNodes.push(...p);
    blockNodes.push(...b);
  }

  return { pageNodes, blockNodes };
};

//export const getAllDiscourseNodesSince = async (
//  since: ISODateString,
//): Promise<RoamDiscourseNodeData[]> => {
//  const sinceMs = new Date(since).getTime();
//
//  const query = `[:find ?uid ?create-time ?edit-time ?user-uuid ?title
//     :keys  source_local_id created last_modified author_local_id text
//     :in $ ?since
//     :where
//      [?e :node/title ?title]
//      [?e :block/uid ?uid]
//      [?e :create/user ?user-id]
//      [?user-id :user/uid ?user-uuid]
//      [?e :create/time ?create-time]
//      [?e :edit/time ?edit-time]
//      [(> ?edit-time ?since)]]`;
//
//  // @ts-ignore - backend to be added to roamjs-components
//  const result = (await window.roamAlphaAPI.data.backend.q(
//    query,
//    sinceMs,
//  )) as unknown[][] as RoamDiscourseNodeData[];
//
//  const discourseNodes = getDiscourseNodes();
//
//  return result
//    .map((entity) => {
//      if (!entity.source_local_id) {
//        return null;
//      }
//      const node = findDiscourseNode(entity.source_local_id, discourseNodes);
//      if (
//        !node ||
//        node.backedBy === "default" ||
//        !entity.text ||
//        entity.text.trim() === ""
//      ) {
//        return null;
//      }
//      return {
//        ...entity,
//        type: node.type,
//      };
//    })
//    .filter((n): n is RoamDiscourseNodeData => n !== null);
//};
//
