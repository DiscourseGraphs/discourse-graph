import { getSupabaseContext } from "./supabaseContext";
import { getNodeEnv } from "roamjs-components/util/env";

export const getAllNodesFromSupabase = async (): Promise<string[]> => {
  try {
    const context = await getSupabaseContext();
    if (!context) {
      console.error("Failed to get Supabase context");
      return [];
    }

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

export const getExistingRoamNodes = (nodeUids: string[]): string[] => {
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

export const getExistingSupabaseNodes = (supabaseUids: string[]): string[] => {
  try {
    const nonExistingUids = getExistingRoamNodes(supabaseUids);
    return nonExistingUids;
  } catch (error) {
    console.error("Error filtering existing Supabase nodes:", error);
    return [];
  }
};

export const getExistingNodesFromSupabase = async (): Promise<string[]> => {
  try {
    const supabaseUids = await getAllNodesFromSupabase();

    if (supabaseUids.length === 0) {
      console.log("No nodes found in Supabase");
      return [];
    }

    const nonExistingUids = getExistingSupabaseNodes(supabaseUids);

    return nonExistingUids;
  } catch (error) {
    console.error("Error in getExistingNodesFromSupabase:", error);
    return [];
  }
};
