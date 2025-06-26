import getDiscourseNodes from "./getDiscourseNodes";
import findDiscourseNode from "./findDiscourseNode";

type RoamDiscourseNodeData = {
  author_local_id: string;
  source_local_id: string;
  created: string;
  last_modified: string;
  author_name: string;
  text: string;
};

type ISODateString = string;

export const getAllDiscourseNodesSince = async (
  since: ISODateString,
): Promise<RoamDiscourseNodeData[]> => {
  const sinceMs = new Date(since).getTime();

  const query = `[:find ?uid ?create-time ?edit-time ?user-uuid ?username ?title
     :keys  source_local_id created last_modified author_local_id author_name text 
     :in $ ?since 
     :where
      [?e :node/title ?title]
      [?e :block/uid ?uid] 
      [?e :create/user ?user-id]
      [?user-id :user/uid ?user-uuid]
      [?user-id :user/display-name ?username]
      [?e :create/time ?create-time]
      [?e :edit/time ?edit-time]
      [(> ?edit-time ?since)]]`;

  // @ts-ignore - backend to be added to roamjs-components
  const result = (await window.roamAlphaAPI.data.backend.q(
    query,
    sinceMs,
  )) as unknown[][] as RoamDiscourseNodeData[];

  const discourseNodes = getDiscourseNodes();

  return result.filter((entity) => {
    if (!entity.source_local_id) return false;
    const node = findDiscourseNode(entity.source_local_id, discourseNodes);
    if (!node) return false;
    if (node.backedBy === "default") return false;
    return Boolean(entity.text && entity.text.trim() !== "");
  });
};
