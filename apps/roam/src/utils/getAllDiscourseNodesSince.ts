import isDiscourseNode from "./isDiscourseNode";
import { getSupabaseContext } from "./supabaseContext";

type RoamEntityFromQuery = {
  uid: string;
  title?: string;
  createTime?: number;
  editTime?: number;
  userUuid?: string;
  username?: string;
};

export const getAllDiscourseNodesSince = async (
  since: number,
): Promise<RoamEntityFromQuery[]> => {
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
};

export const getLastSyncTime = async (): Promise<string | null> => {
  try {
    const context = await getSupabaseContext();
    if (!context) {
      console.error("Failed to get supabase context");
      return null;
    }

    const { spaceId } = context;

    const response = await fetch(
      `https://discoursegraphs.com/api/supabase/sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          spaceId: spaceId,
        }),
      },
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(
        `Error fetching last sync time for spaceId ${spaceId}: ${response.status} ${response.statusText}`,
        errorBody,
      );
      return null;
    }

    const data = await response.json();
    console.log("sync data", data);

    // Handle the API response format
    if (data && data.last_task_end) {
      return data.last_task_end;
    }

    // If no sync record exists yet
    return null;
  } catch (error) {
    console.error("Network or other error fetching last sync time:", error);
    return null;
  }
};
