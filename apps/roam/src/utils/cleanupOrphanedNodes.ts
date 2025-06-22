import { getSupabaseContext } from "./supabaseContext";
import { getNodeEnv } from "roamjs-components/util/env";

export const getAllNodesFromSupabase = async (): Promise<string[]> => {
  try {
    const context = await getSupabaseContext();
    if (!context) {
      console.error("Failed to get Supabase context");
      return [];
    }

    console.log("context", context);

    const baseUrl =
      getNodeEnv() === "development"
        ? "http://localhost:3000/api/supabase"
        : "https://discoursegraphs.com/api/supabase";

    const getNodesResponse = await fetch(`${baseUrl}/get-all-nodes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        spaceId: context.spaceId,
      }),
    });

    if (!getNodesResponse.ok) {
      const errorText = await getNodesResponse.text();
      console.error(
        `Failed to fetch nodes from Supabase: ${getNodesResponse.status} ${errorText}`,
      );
      return [];
    }

    const supabaseUids = (await getNodesResponse.json()) as string[];
    return supabaseUids;
  } catch (error) {
    console.error("Error in getAllNodesFromSupabase:", error);
    return [];
  }
};

export const getNonExistentRoamUids = (nodeUids: string[]): string[] => {
  try {
    if (nodeUids.length === 0) {
      return [];
    }

    const results = window.roamAlphaAPI.q(
      `[:find ?uid 
        :in $ [?uid ...]
        :where (not [_ :block/uid ?uid])]`,
      nodeUids,
    ) as string[][];

    return results.map(([uid]) => uid);
  } catch (error) {
    console.error("Error checking existing Roam nodes:", error);
    return [];
  }
};

export const deleteNodesFromSupabase = async (
  uids: string[],
): Promise<number> => {
  try {
    const context = await getSupabaseContext();
    if (!context) {
      console.error("Failed to get Supabase context");
      return 0;
    }

    const baseUrl =
      getNodeEnv() === "development"
        ? "http://localhost:3000/api/supabase"
        : "https://discoursegraphs.com/api/supabase";

    const deleteNodesResponse = await fetch(`${baseUrl}/delete-nodes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        spaceId: context.spaceId,
        uids,
      }),
    });

    if (!deleteNodesResponse.ok) {
      const errorText = await deleteNodesResponse.text();
      console.error(
        `Failed to delete nodes from Supabase: ${deleteNodesResponse.status} ${errorText}`,
      );
      return 0;
    }

    const { count } = await deleteNodesResponse.json();
    return count;
  } catch (error) {
    console.error("Error in deleteNodesFromSupabase:", error);
    return 0;
  }
};

export const cleanupOrphanedNodes = async (): Promise<void> => {
  try {
    console.log("Cleaning up orphaned nodes...");
    const supabaseUids = await getAllNodesFromSupabase();
    console.log("supabaseUids", supabaseUids);

    if (supabaseUids.length === 0) {
      console.log("No nodes found in Supabase");
      return;
    }

    const orphanedUids = getNonExistentRoamUids(supabaseUids);
    console.log("orphanedUids", orphanedUids);

    if (orphanedUids.length === 0) {
      console.log("No orphaned nodes found");
      return;
    }

    console.log(
      `Found ${orphanedUids.length} orphaned nodes, deleting...`,
      orphanedUids,
    );
    await deleteNodesFromSupabase(orphanedUids);
  } catch (error) {
    console.error("Error in cleanupOrphanedNodes:", error);
  }
};
