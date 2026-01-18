import type { SupabaseContext } from "./supabaseContext";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import internalError from "./internalError";

const getAllNodesFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<string[]> => {
  try {
    const { data: schemas, error: schemasError } = await supabaseClient
      .from("Concept")
      .select("id")
      .eq("space_id", spaceId)
      .eq("is_schema", true)
      .eq("arity", 0);

    if (schemasError) {
      internalError({
        error: schemasError,
        userMessage: "Failed to get all discourse node schemas from Supabase:",
      });
      return [];
    }

    const schemaIds = schemas.map((s: { id: number }) => s.id);
    let nodeResult: string[] = [];

    if (schemaIds.length > 0) {
      const conceptResponse = await supabaseClient
        .from("Concept")
        .select("source_local_id")
        .eq("space_id", spaceId)
        .eq("is_schema", false)
        .in("schema_id", schemaIds)
        .not("source_local_id", "is", null);

      if (conceptResponse.error) {
        internalError({
          error: conceptResponse.error,
          userMessage: "Failed to get concepts from Supabase",
          type: "cleanup_orphans_get_concepts",
        });
        return [];
      }
      nodeResult =
        conceptResponse.data
          ?.map(
            (c: { source_local_id: string | null }) =>
              c.source_local_id || null,
          )
          .filter((id: string | null): id is string => !!id) || [];
    }

    const blockContentResponse = await supabaseClient
      .from("Content")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .eq("scale", "block")
      .not("source_local_id", "is", null);

    if (blockContentResponse.error) {
      internalError({
        error: blockContentResponse.error,
        userMessage: "Failed to get block content from Supabase:",
      });
      return [];
    }

    const blockResult =
      blockContentResponse.data
        ?.map((c: { source_local_id: string | null }) => c.source_local_id)
        .filter((id: string | null): id is string => !!id) || [];

    const result = [...new Set([...nodeResult, ...blockResult])];

    return result;
  } catch (error) {
    internalError({ error, userMessage: "Error in getAllNodesFromSupabase:" });
    return [];
  }
};

const getAllNodeSchemasFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<string[]> => {
  try {
    const { data, error } = await supabaseClient
      .from("Concept")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .eq("is_schema", true)
      .eq("arity", 0)
      .not("source_local_id", "is", null);

    if (error) {
      internalError({
        error,
        userMessage: "Failed to get all discourse node schemas from Supabase",
        type: "cleanup_orphans_get_schemas",
      });
      return [];
    }

    return (
      data
        ?.map(
          (c: { source_local_id: string | null }) => c.source_local_id || null,
        )
        .filter((id: string | null): id is string => !!id) || []
    );
  } catch (error) {
    internalError({
      error,
      userMessage: "Error in getAllNodeSchemasFromSupabase",
    });
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
    internalError({
      error,
      userMessage: "Error checking existing Roam nodes",
    });
    return [];
  }
};

const deleteNodesFromSupabase = async (
  uids: string[],
  spaceId: number,
  supabaseClient: DGSupabaseClient,
): Promise<void> => {
  try {
    if (uids.length === 0) return;

    const { error: conceptDeleteError } = await supabaseClient
      .from("Concept")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", uids)
      .eq("is_schema", false);

    if (conceptDeleteError) {
      internalError({
        error: conceptDeleteError,
        userMessage: "Failed to delete concepts from Supabase",
      });
    }

    const { error: contentDeleteError } = await supabaseClient
      .from("Content")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", uids);

    if (contentDeleteError) {
      internalError({
        error: contentDeleteError,
        userMessage: "Failed to delete content from Supabase:",
      });
    }
  } catch (error) {
    internalError({ error, userMessage: "Error in deleteNodesFromSupabase" });
  }
};

const deleteNodeSchemasFromSupabase = async (
  uids: string[],
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<void> => {
  try {
    if (uids.length === 0) return;

    const { data: schemaConceptData, error: schemaConceptError } =
      await supabaseClient
        .from("Concept")
        .select("id")
        .eq("space_id", spaceId)
        .eq("is_schema", true)
        .in("source_local_id", uids);

    if (schemaConceptError) {
      internalError({
        error: schemaConceptError,
        userMessage:
          "deleteNodeSchemasFromSupabase: schema concept lookup failed",
      });
    }

    const schemaConceptIds = (schemaConceptData || []).map(
      (c: { id: number }) => c.id,
    );

    if (schemaConceptIds.length > 0) {
      const { data: instanceConceptData, error: instanceConceptError } =
        await supabaseClient
          .from("Concept")
          .select("source_local_id")
          .eq("space_id", spaceId)
          .eq("is_schema", false)
          .in("schema_id", schemaConceptIds);

      if (instanceConceptError) {
        internalError({
          error: instanceConceptError,
          userMessage:
            "deleteNodeSchemasFromSupabase: instance concept lookup failed",
        });
      } else {
        const instanceSourceLocalIds = (instanceConceptData || [])
          .map((ic: { source_local_id: string | null }) => ic.source_local_id)
          .filter((x: string | null): x is string => typeof x === "string");

        if (instanceSourceLocalIds.length > 0) {
          const { error: deleteInstanceConceptError } = await supabaseClient
            .from("Concept")
            .delete()
            .eq("is_schema", false)
            .eq("space_id", spaceId)
            .in("source_local_id", instanceSourceLocalIds);
          if (deleteInstanceConceptError) {
            internalError({
              error: deleteInstanceConceptError,
              userMessage:
                "deleteNodeSchemasFromSupabase: delete instance concepts failed",
            });
          }
          const { error: deleteInstanceContentError } = await supabaseClient
            .from("Content")
            .delete()
            .eq("space_id", spaceId)
            .in("source_local_id", instanceSourceLocalIds);
          if (deleteInstanceContentError) {
            internalError({
              error: deleteInstanceContentError,
              userMessage:
                "deleteNodeSchemasFromSupabase: delete instance contents failed",
            });
          }
          const { error: deleteInstanceDocumentError } = await supabaseClient
            .from("Document")
            .delete()
            .eq("space_id", spaceId)
            .in("source_local_id", instanceSourceLocalIds);
          if (deleteInstanceDocumentError) {
            internalError({
              error: deleteInstanceDocumentError,
              userMessage:
                "deleteNodeSchemasFromSupabase: delete instance document failed",
            });
          }
        }
      }

      const { error: deleteSchemaConceptError } = await supabaseClient
        .from("Concept")
        .delete()
        .in("id", schemaConceptIds);
      if (deleteSchemaConceptError) {
        internalError({
          error: deleteSchemaConceptError,
          userMessage:
            "deleteNodeSchemasFromSupabase: delete schema concepts failed",
        });
      }
    }

    const { error: deleteSchemaContentError } = await supabaseClient
      .from("Content")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", uids);
    if (deleteSchemaContentError) {
      internalError({
        error: deleteSchemaContentError,
        userMessage: "deleteNodeSchemasFromSupabase: delete content failed",
      });
    }

    const { error: deleteSchemaDocument } = await supabaseClient
      .from("Document")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", uids);
    if (deleteSchemaDocument) {
      internalError({
        error: deleteSchemaDocument,
        userMessage: "deleteNodeSchemasFromSupabase: delete documents failed",
      });
    }
  } catch (error) {
    internalError({
      error,
      userMessage: "Error in deleteNodeSchemasFromSupabase",
    });
  }
};

export const cleanupOrphanedNodes = async (
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<void> => {
  try {
    const supabaseUids = await getAllNodesFromSupabase(
      supabaseClient,
      context.spaceId,
    );
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
      context.spaceId,
    );
    if (supabaseSchemaUids.length > 0) {
      const orphanedSchemaUids = getNonExistentRoamUids(supabaseSchemaUids);
      if (orphanedSchemaUids.length > 0) {
        await deleteNodeSchemasFromSupabase(
          orphanedSchemaUids,
          supabaseClient,
          context.spaceId,
        );
      }
    }
  } catch (error) {
    internalError({ error, userMessage: "Error in cleanupOrphanedNodes:" });
  }
};
