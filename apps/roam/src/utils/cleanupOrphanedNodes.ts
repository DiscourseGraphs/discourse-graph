import { getSupabaseContext } from "./supabaseContext";
import { getNodeEnv } from "roamjs-components/util/env";

const getAllNodesFromSupabase = async (): Promise<string[]> => {
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

    const getNodesResponse = await fetch(`${baseUrl}/get-all-discourse-nodes`, {
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

const getAllNodeSchemasFromSupabase = async (): Promise<string[]> => {
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

    const getSchemasResponse = await fetch(
      `${baseUrl}/get-all-discourse-node-schemas`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spaceId: context.spaceId,
        }),
      },
    );

    if (!getSchemasResponse.ok) {
      const errorText = await getSchemasResponse.text();
      console.error(
        `Failed to fetch node schemas from Supabase: ${getSchemasResponse.status} ${errorText}`,
      );
      return [];
    }

    const supabaseUids = (await getSchemasResponse.json()) as string[];
    return supabaseUids;
  } catch (error) {
    console.error("Error in getAllNodeSchemasFromSupabase:", error);
    return [];
  }
};

const getNonExistentRoamUids = (nodeUids: string[]): string[] => {
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

    console.log("results", results);
    return results.map(([uid]) => uid);
  } catch (error) {
    console.error("Error checking existing Roam nodes:", error);
    return [];
  }
};

const deleteNodesFromSupabase = async (uids: string[]): Promise<number> => {
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

    const deleteNodesResponse = await fetch(
      `${baseUrl}/delete-discourse-nodes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spaceId: context.spaceId,
          uids,
        }),
      },
    );

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

const deleteNodeSchemasFromSupabase = async (
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

    const deleteNodesResponse = await fetch(
      `${baseUrl}/delete-discourse-node-schemas`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spaceId: context.spaceId,
          uids,
        }),
      },
    );

    if (!deleteNodesResponse.ok) {
      const errorText = await deleteNodesResponse.text();
      console.error(
        `Failed to delete node schemas from Supabase: ${deleteNodesResponse.status} ${errorText}`,
      );
      return 0;
    }

    const { count } = await deleteNodesResponse.json();
    return count;
  } catch (error) {
    console.error("Error in deleteNodeSchemasFromSupabase:", error);
    return 0;
  }
};

export const cleanupOrphanedNodes = async (): Promise<void> => {
  console.log("CleanupOrphanedNodes: Starting process.");
  try {
    const supabaseUids = await getAllNodesFromSupabase();
    console.log("supabaseUids", supabaseUids);
    if (supabaseUids.length > 0) {
      const orphanedUids = getNonExistentRoamUids(supabaseUids);
      console.log("orphanedUids", orphanedUids);
      if (orphanedUids.length > 0) {
        console.log(
          `cleanupOrphanedNodes: Deleting ${orphanedUids.length} orphaned nodes from Supabase.`,
        );
        await deleteNodesFromSupabase(orphanedUids);
        console.log(
          `cleanupOrphanedNodes: Deleted orphaned nodes from Supabase.`,
        );
      }
    }

    const supabaseSchemaUids = await getAllNodeSchemasFromSupabase();
    console.log("supabaseSchemaUids", supabaseSchemaUids);
    if (supabaseSchemaUids.length > 0) {
      const orphanedSchemaUids = getNonExistentRoamUids(supabaseSchemaUids);
      console.log("orphanedSchemaUids", orphanedSchemaUids);
      if (orphanedSchemaUids.length > 0) {
        console.log(
          `cleanupOrphanedNodes: Deleting ${orphanedSchemaUids.length} orphaned node schemas from Supabase.`,
        );
        await deleteNodeSchemasFromSupabase(orphanedSchemaUids);
        console.log(
          `cleanupOrphanedNodes: Deleted orphaned node schemas from Supabase.`,
        );
      }
    }
  } catch (error) {
    console.error("Error in cleanupOrphanedNodes:", error);
  }
};
