import isDiscourseNode from "./isDiscourseNode";

export type DiscourseGraphContent = {
  author_local_id: string;
  source_local_id: string;
  scale: string;
  created: string;
  last_modified: string;
  text: string;
};

export const getAllDiscourseNodesSince = async (
  since: string,
): Promise<DiscourseGraphContent[]> => {
  const roamAlpha = (window as any).roamAlphaAPI;
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

  const result = roamAlpha.data.q(query, sinceMs) as DiscourseGraphContent[];

  return result.filter(
    (entity) =>
      entity.source_local_id &&
      isDiscourseNode(entity.source_local_id) &&
      entity.text &&
      entity.text.trim() !== "",
  );
};
