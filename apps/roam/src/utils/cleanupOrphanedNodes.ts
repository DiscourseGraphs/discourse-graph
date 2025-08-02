import { getSupabaseContext, type SupabaseContext } from "./supabaseContext";
import { getNodeEnv } from "roamjs-components/util/env";
import { type SupabaseClient } from "@supabase/supabase-js";
import { type Database } from "@repo/database/types.gen";

type DGSupabaseClient = SupabaseClient<Database, "public", Database["public"]>;

const getAllNodesFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<string[]> => {
  try {
    if (!context) {
      console.error("Failed to get Supabase context");
      return [];
    }
    const { spaceId } = context;

    const { data: schemas, error: schemasError } = await supabaseClient
      .from("Concept")
      .select("id")
      .eq("space_id", spaceId)
      .eq("is_schema", true)
      .eq("arity", 0);

    if (schemasError) {
      console.error(
        "Failed to get all discourse node schemas from Supabase:",
        schemasError,
      );
      return [];
    }

    const schemaIds = schemas.map((s) => s.id);
    let nodeResult: string[] = [];

    if (schemaIds.length > 0) {
      const conceptResponse = await supabaseClient
        .from("Concept")
        .select(
          `
        Content!inner (
            source_local_id
        )
      `,
        )
        .eq("space_id", spaceId)
        .eq("is_schema", false)
        .in("schema_id", schemaIds)
        .not("Content.source_local_id", "is", null);

      if (conceptResponse.error) {
        console.error(
          "Failed to get concepts from Supabase:",
          conceptResponse.error,
        );
        return [];
      }
      nodeResult =
        conceptResponse.data
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ?.map((c: any) => c.Content?.source_local_id)
          .filter((id): id is string => !!id) || [];
    }

    const blockContentResponse = await supabaseClient
      .from("Content")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .eq("scale", "block")
      .not("source_local_id", "is", null);

    if (blockContentResponse.error) {
      console.error(
        "Failed to get block content from Supabase:",
        blockContentResponse.error,
      );
      return [];
    }

    const blockResult =
      blockContentResponse.data
        ?.map((c) => c.source_local_id)
        .filter((id): id is string => !!id) || [];

    const result = [...new Set([...nodeResult, ...blockResult])];

    return result;
  } catch (error) {
    console.error("Error in getAllNodesFromSupabase:", error);
    return [];
  }
};

const getAllNodeSchemasFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<string[]> => {
  try {
    if (!context) {
      console.error("Failed to get Supabase context");
      return [];
    }

    const { data, error } = await supabaseClient
      .from("Concept")
      .select(
        `
        Content!inner (
            source_local_id
        )
      `,
      )
      .eq("space_id", context.spaceId)
      .eq("is_schema", true)
      // Node schemas have arity 0 (relations have arity > 0)
      .eq("arity", 0)
      .not("Content.source_local_id", "is", null);

    if (error) {
      console.error(
        "Failed to get all discourse node schemas from Supabase:",
        error,
      );
      return [];
    }

    return (
      data
        ?.map((c) => c.Content?.source_local_id)
        .filter((id): id is string => !!id) || []
    );
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

const deleteNodesFromSupabase = async (
  uids: string[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<number> => {
  try {
    if (!context) {
      console.error("Failed to get Supabase context");
      return 0;
    }

    const { data, error } = await supabaseClient.rpc(
      "delete_discourse_nodes" as any,
      {
        space_id: context.spaceId,
        uids,
      },
    );
    if (error) {
      console.error("Failed to delete nodes from Supabase:", error);
      return 0;
    }
    return data.length;
  } catch (error) {
    console.error("Error in deleteNodesFromSupabase:", error);
    return 0;
  }
};

const deleteNodeSchemasFromSupabase = async (
  uids: string[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<number> => {
  try {
    if (!context) {
      console.error("Failed to get Supabase context");
      return 0;
    }

    const { data, error } = await supabaseClient.rpc(
      "delete_discourse_node_schemas" as any,
      {
        space_id: context.spaceId,
        uids,
      },
    );
    if (error) {
      console.error("Failed to delete node schemas from Supabase:", error);
      return 0;
    }
    return data.length;
  } catch (error) {
    console.error("Error in deleteNodeSchemasFromSupabase:", error);
    return 0;
  }
};

export const cleanupOrphanedNodes = async (
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<void> => {
  console.log("CleanupOrphanedNodes: Starting process.");
  try {
    const supabaseUids = await getAllNodesFromSupabase(supabaseClient, context);
    console.log("supabaseUids", supabaseUids);
    if (supabaseUids.length > 0) {
      const orphanedUids = getNonExistentRoamUids(supabaseUids);
      console.log("orphanedUids", orphanedUids);
      if (orphanedUids.length > 0) {
        console.log(
          `cleanupOrphanedNodes: Deleting ${orphanedUids.length} orphaned nodes from Supabase.`,
        );
        await deleteNodesFromSupabase(orphanedUids, supabaseClient, context);
        console.log(
          `cleanupOrphanedNodes: Deleted orphaned nodes from Supabase.`,
        );
      }
    }

    const supabaseSchemaUids = await getAllNodeSchemasFromSupabase(
      supabaseClient,
      context,
    );
    console.log("supabaseSchemaUids", supabaseSchemaUids);
    if (supabaseSchemaUids.length > 0) {
      const orphanedSchemaUids = getNonExistentRoamUids(supabaseSchemaUids);
      console.log("orphanedSchemaUids", orphanedSchemaUids);
      if (orphanedSchemaUids.length > 0) {
        console.log(
          `cleanupOrphanedNodes: Deleting ${orphanedSchemaUids.length} orphaned node schemas from Supabase.`,
        );
        await deleteNodeSchemasFromSupabase(
          orphanedSchemaUids,
          supabaseClient,
          context,
        );
        console.log(
          `cleanupOrphanedNodes: Deleted orphaned node schemas from Supabase.`,
        );
      }
    }
  } catch (error) {
    console.error("Error in cleanupOrphanedNodes:", error);
  }
};
