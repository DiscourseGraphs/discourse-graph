import isDiscourseNode from "./isDiscourseNode";

// Type for results from the Roam Datalog query
type RoamEntityFromQuery = {
  ":block/uid": string;
  ":node/title"?: string;
  ":block/string"?: string;
  ":edit/time"?: number;
  ":create/time"?: number;
};

type RoamContentNode = {
  uid: string;
  string: string; // Primary text content for embedding - THIS WILL BE THE TITLE
  "edit/time"?: number;
  "create/time"?: number;
};
export async function getAllDiscourseNodes(
  since: number,
): Promise<RoamContentNode[]> {
  // We are using a forked version of findDiscouseNode that uses the title instead of the uid
  // because uid runs query for every node, and is too slow.

  const roamAlpha = (window as any).roamAlphaAPI;
  const query =
    "[:find (pull ?e [:block/uid :node/title :edit/time :create/time]) :where [?e :node/title]]";
  return (roamAlpha.data.fast.q(query) as [RoamEntityFromQuery][])
    .map(([entity]) => entity)
    .filter(
      (entity) =>
        entity[":block/uid"] &&
        isDiscourseNode(entity[":block/uid"]) &&
        entity[":node/title"] &&
        entity[":node/title"]!.trim() !== "" &&
        entity[":edit/time"] &&
        entity[":edit/time"] > since,
    )
    .map((entity) => ({
      uid: entity[":block/uid"],
      string: entity[":node/title"]!.trim(),
      "edit/time": entity[":edit/time"],
      "create/time": entity[":create/time"],
    }));
}

export async function getLastSyncTime() {
  // TODO: Manage this URL through your Roam extension's configuration or build process.
  // Use your actual deployed website URL in production.
  const API_BASE_URL =
    process.env.NODE_ENV === "production"
      ? "https://your-discourse-graph-website.com" // REPLACE with your actual production URL
      : "http://localhost:3000"; // Common local development URL for Next.js apps

  const response = await fetch(
    `${API_BASE_URL}/api/supabase/rpc/get-last-update-time`,
  );
  if (!response.ok) {
    // Handle HTTP errors like 404 or 500
    const errorBody = await response.text(); // or response.json() if your errors are JSON
    console.error(
      `Error fetching last sync time: ${response.status} ${response.statusText}`,
      errorBody,
    );
    throw new Error(
      `Failed to fetch last sync time: ${response.status} ${response.statusText}`,
    );
  }
  const data = await response.json();
  return data.last_update_time;
}

export async function upsertDiscourseNodes() {
  // upsert in batch
  // use supabase client
  // use upsert function
  // use batch size of 100
  // use on conflict do nothing
}
