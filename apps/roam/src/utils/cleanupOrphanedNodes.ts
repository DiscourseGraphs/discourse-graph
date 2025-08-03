import { type SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseContext,
  getLoggedInClient,
  type SupabaseContext,
} from "./supabaseContext";
import { getNodeEnv } from "roamjs-components/util/env";
import { asPostgrestFailure } from "@repo/ui/lib/supabase/contextFunctions";

const getAllNodesFromSupabase = async (
  spaceId: number,
  supabaseClient: SupabaseClient,
): Promise<string[]> => {
  try {
    const allNodeInstanceIds = await supabaseClient
      .from("Content")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .eq("scale", "block")
      .not("source_local_id", "is", null);

    if (allNodeInstanceIds.error) {
      console.error(
        "Failed to get all discourse node schemas from Supabase:",
        allNodeInstanceIds.error,
      );
      return [];
    }
    const result =
      allNodeInstanceIds.data
        ?.map((c) => c.source_local_id)
        .filter((id): id is string => !!id) || [];

    return result;
  } catch (error) {
    console.error("Error in getAllNodesFromSupabase:", error);
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

    return results.map(([uid]) => uid);
  } catch (error) {
    console.error("Error checking existing Roam nodes:", error);
    return [];
  }
};

const deleteNodesFromSupabase = async (
  uids: string[],
  spaceId: number,
  supabaseClient: SupabaseClient,
): Promise<void> => {
  try {
    const { data: contentData, error: contentError } = await supabaseClient
      .from("Content")
      .select("id")
      .eq("space_id", spaceId)
      .in("source_local_id", uids);

    if (contentError) {
      console.error("Failed to get content from Supabase:", contentError);
    }

    const contentIds = contentData?.map((c) => c.id) || [];

    if (contentIds.length > 0) {
      const { error: conceptError } = await supabaseClient
        .from("Concept")
        .delete()
        .in("represented_by_id", contentIds)
        .eq("is_schema", false);

      if (conceptError) {
        console.error("Failed to delete concepts from Supabase:", conceptError);
      }

      const { error: contentDeleteError } = await supabaseClient
        .from("Content")
        .delete()
        .in("id", contentIds);

      if (contentDeleteError) {
        console.error(
          "Failed to delete content from Supabase:",
          contentDeleteError,
        );
      }
    }
  } catch (error) {
    console.error("Error in deleteNodesFromSupabase:", error);
  }
};

export const cleanupOrphanedNodes = async (): Promise<void> => {
  const context = await getSupabaseContext();
  if (!context) {
    console.error("Failed to get Supabase context");
    return;
  }
  const spaceId = context.spaceId;

  const supabaseClient = await getLoggedInClient();
  try {
    const supabaseUids = await getAllNodesFromSupabase(spaceId, supabaseClient);
    if (supabaseUids.length === 0) {
      return;
    }
    const orphanedUids = getNonExistentRoamUids(supabaseUids);
    if (orphanedUids.length === 0) {
      return;
    }
    await deleteNodesFromSupabase(orphanedUids, spaceId, supabaseClient);
  } catch (error) {
    console.error("Error in cleanupOrphanedNodes:", error);
  }
};
