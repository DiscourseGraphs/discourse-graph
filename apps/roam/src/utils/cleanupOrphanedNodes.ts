import {
  getSupabaseContext,
  getLoggedInClient,
  type SupabaseContext,
} from "./supabaseContext";
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
          ?.map((c) => c.Content?.source_local_id)
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

    return results.map(([uid]) => uid);
  } catch (error) {
    console.error("Error checking existing Roam nodes:", error);
    return [];
  }
};

const deleteNodesFromSupabase = async (
  uids: string[],
  spaceId: number,
  supabaseClient: DGSupabaseClient,
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

const deleteNodeSchemasFromSupabase = async (
  uids: string[],
): Promise<number> => {
  try {
    const context = await getSupabaseContext();
    if (!context) {
      console.error("Failed to get Supabase context");
      return 0;
    }
    if (uids.length === 0) return 0;

    const supabaseClient = await getLoggedInClient();
    const { spaceId } = context;

    const { data: schemaContentData, error: contentLookupError } =
      await supabaseClient
        .from("Content")
        .select("id, source_local_id")
        .eq("space_id", spaceId)
        .in("source_local_id", uids);

    if (contentLookupError) {
      console.error(
        "deleteNodeSchemasFromSupabase: content lookup failed:",
        contentLookupError,
      );
      return 0;
    }

    if (!schemaContentData || schemaContentData.length === 0) {
      return 0;
    }

    const schemaContentIds = schemaContentData.map((c) => c.id);

    const { data: schemaConceptData, error: schemaConceptError } =
      await supabaseClient
        .from("Concept")
        .select("id")
        .eq("space_id", spaceId)
        .eq("is_schema", true)
        .in("represented_by_id", schemaContentIds);

    if (schemaConceptError) {
      console.error(
        "deleteNodeSchemasFromSupabase: schema concept lookup failed:",
        schemaConceptError,
      );
      return 0;
    }

    const schemaConceptIds = (schemaConceptData || []).map((c) => c.id);

    let instanceConceptIds: number[] = [];
    let instanceContentIds: number[] = [];
    let instanceSourceLocalIds: string[] = [];

    if (schemaConceptIds.length > 0) {
      const { data: instanceConceptData, error: instanceConceptError } =
        await supabaseClient
          .from("Concept")
          .select("id, represented_by_id")
          .eq("space_id", spaceId)
          .eq("is_schema", false)
          .in("schema_id", schemaConceptIds);

      if (instanceConceptError) {
        console.error(
          "deleteNodeSchemasFromSupabase: instance concept lookup failed:",
          instanceConceptError,
        );
        return 0;
      }

      instanceConceptIds = (instanceConceptData || []).map((ic) => ic.id);
      instanceContentIds = (instanceConceptData || [])
        .map((ic) => ic.represented_by_id)
        .filter((x): x is number => typeof x === "number");

      if (instanceContentIds.length > 0) {
        const { data: instanceContentData, error: instanceContentLookupError } =
          await supabaseClient
            .from("Content")
            .select("source_local_id")
            .in("id", instanceContentIds);

        if (instanceContentLookupError) {
          console.error(
            "deleteNodeSchemasFromSupabase: instance content lookup failed:",
            instanceContentLookupError,
          );
          return 0;
        }
        instanceSourceLocalIds = (instanceContentData || [])
          .map((c) => c.source_local_id)
          .filter((id): id is string => !!id);
      }
    }

    if (instanceConceptIds.length > 0) {
      const { error: deleteInstanceConceptError } = await supabaseClient
        .from("Concept")
        .delete()
        .in("id", instanceConceptIds);
      if (deleteInstanceConceptError) {
        console.error(
          "deleteNodeSchemasFromSupabase: delete instance concepts failed:",
          deleteInstanceConceptError,
        );
        return 0;
      }
    }

    if (schemaConceptIds.length > 0) {
      const { error: deleteSchemaConceptError } = await supabaseClient
        .from("Concept")
        .delete()
        .in("id", schemaConceptIds);
      if (deleteSchemaConceptError) {
        console.error(
          "deleteNodeSchemasFromSupabase: delete schema concepts failed:",
          deleteSchemaConceptError,
        );
        return 0;
      }
    }

    const allContentIds = [...schemaContentIds, ...instanceContentIds];
    if (allContentIds.length > 0) {
      const { error: deleteContentError } = await supabaseClient
        .from("Content")
        .delete()
        .in("id", allContentIds);
      if (deleteContentError) {
        console.error(
          "deleteNodeSchemasFromSupabase: delete content failed:",
          deleteContentError,
        );
        return 0;
      }
    }

    const docLocalIds = [...uids, ...instanceSourceLocalIds];
    let deletedDocsCount = 0;
    if (docLocalIds.length > 0) {
      const { error: docError, count } = await supabaseClient
        .from("Document")
        .delete({ count: "exact" })
        .eq("space_id", spaceId)
        .in("source_local_id", docLocalIds);
      if (docError) {
        console.error(
          "deleteNodeSchemasFromSupabase: delete documents failed:",
          docError,
        );
        return 0;
      }
      deletedDocsCount = count ?? 0;
    }

    return deletedDocsCount;
  } catch (error) {
    console.error("Error in deleteNodeSchemasFromSupabase:", error);
    return 0;
  }
};

export const cleanupOrphanedNodes = async (
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<void> => {
  try {
    const supabaseUids = await getAllNodesFromSupabase(supabaseClient, context);
    if (supabaseUids.length > 0) {
      const orphanedUids = getNonExistentRoamUids(supabaseUids);
      if (orphanedUids.length > 0) {
        await deleteNodesFromSupabase(
          orphanedUids,
          context.spaceId,
          supabaseClient,
        );
      }
    }

    const supabaseSchemaUids = await getAllNodeSchemasFromSupabase(
      supabaseClient,
      context,
    );
    if (supabaseSchemaUids.length > 0) {
      const orphanedSchemaUids = getNonExistentRoamUids(supabaseSchemaUids);
      if (orphanedSchemaUids.length > 0) {
        await deleteNodeSchemasFromSupabase(orphanedSchemaUids);
      }
    }
  } catch (error) {
    console.error("Error in cleanupOrphanedNodes:", error);
  }
};
