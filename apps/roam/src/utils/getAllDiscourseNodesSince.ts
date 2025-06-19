import isDiscourseNode from "./isDiscourseNode";

type RoamEntityFromQuery = {
  uid: string;
  title?: string;
  createTime?: number;
  editTime?: number;
  userUuid?: string;
  username?: string;
};

export async function getAllDiscourseNodesSince(
  since: number,
): Promise<RoamEntityFromQuery[]> {
  const roamAlpha = (window as any).roamAlphaAPI;

  const query = `[:find ?uid ?create-time ?edit-time ?user-uuid ?username ?title
     :keys  uid   createTime    editTime    userUuid   username title
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

  const result = roamAlpha.data.q(query, since) as RoamEntityFromQuery[];
  console.log("result", result);

  return result.filter(
    (entity) =>
      entity.uid &&
      isDiscourseNode(entity.uid) &&
      entity.title &&
      entity.title.trim() !== "",
  );
}
