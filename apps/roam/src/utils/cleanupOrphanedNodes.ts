import type { PostgrestResponse } from "@supabase/supabase-js";
import type { SupabaseContext } from "./supabaseContext";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Tables } from "@repo/database/dbTypes";
import internalError from "./internalError";

const getAllConceptLocalIdsFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<string[]> => {
  try {
    const { data, error } = await supabaseClient
      .from("my_concepts")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .eq("is_schema", false)
      .not("source_local_id", "is", null);

    if (error) {
      internalError({
        error: error,
        userMessage: "Failed to get concepts from Supabase",
        type: "cleanup_orphans_get_concepts",
      });
      return [];
    }
    return (
      data?.map((c) => c.source_local_id).filter((id) => id !== null) || []
    );
  } catch (error) {
    internalError({
      error,
      userMessage: "Error in getAllConceptLocalIdsFromSupabase:",
    });
    return [];
  }
};

const getAllDocumentLocalIdsFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<string[]> => {
  try {
    const { error, data } = await supabaseClient
      .from("my_documents")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .not("source_local_id", "is", null);

    if (error) {
      internalError({
        error: error,
        userMessage: "Failed to get document ids from Supabase:",
      });
      return [];
    }

    return (
      data?.map((c) => c.source_local_id).filter((id) => id !== null) || []
    );
  } catch (error) {
    internalError({
      error,
      userMessage: "Error in getAllDocumentLocalIdsFromSupabase:",
    });
    return [];
  }
};

const getAllContentLocalIdsFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<string[]> => {
  try {
    const { data, error } = await supabaseClient
      .from("my_contents")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .not("source_local_id", "is", null);

    if (error) {
      internalError({
        error: error,
        userMessage: "Failed to get block content from Supabase:",
      });
      return [];
    }

    return (
      data?.map((c) => c.source_local_id).filter((id) => id !== null) || []
    );
  } catch (error) {
    internalError({
      error,
      userMessage: "Error in getAllContentLocalIdsFromSupabase:",
    });
    return [];
  }
};

const getAllNodeSchemasFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<string[]> => {
  try {
    const { data, error } = await supabaseClient
      .from("my_concepts")
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

const deleteConceptsFromSupabase = async (
  uids: string[],
  spaceId: number,
  supabaseClient: DGSupabaseClient,
): Promise<void> => {
  try {
    if (uids.length === 0) return;

    const { error: error } = await supabaseClient
      .from("Concept")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", uids)
      .eq("is_schema", false);

    if (error) {
      internalError({
        error,
        userMessage: "Failed to delete concepts from Supabase",
      });
    }
  } catch (error) {
    internalError({
      error,
      userMessage: "Error in deleteConceptsFromSupabase",
    });
  }
};

const deleteContentFromSupabase = async (
  uids: string[],
  spaceId: number,
  supabaseClient: DGSupabaseClient,
): Promise<void> => {
  try {
    if (uids.length === 0) return;

    const { error } = await supabaseClient
      .from("Content")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", uids);

    if (error) {
      internalError({
        error,
        userMessage: "Failed to delete contents from Supabase",
      });
    }
  } catch (error) {
    internalError({
      error,
      userMessage: "Error in deleteContentsFromSupabase",
    });
  }
};

const deleteDocumentsFromSupabase = async (
  uids: string[],
  spaceId: number,
  supabaseClient: DGSupabaseClient,
): Promise<void> => {
  try {
    if (uids.length === 0) return;

    const { error: error } = await supabaseClient
      .from("Document")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", uids);

    if (error) {
      internalError({
        error,
        userMessage: "Failed to delete Documents from Supabase",
      });
    }
  } catch (error) {
    internalError({
      error,
      userMessage: "Error in deleteDocumentsFromSupabase",
    });
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
      (await supabaseClient
        .from("my_concepts")
        .select("id")
        .eq("space_id", spaceId)
        .eq("is_schema", true)
        .in("source_local_id", uids)) as PostgrestResponse<Tables<"Concept">>;

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
          .from("my_concepts")
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
    const conceptUids = await getAllConceptLocalIdsFromSupabase(
      supabaseClient,
      context.spaceId,
    );
    if (conceptUids.length > 0) {
      const orphanedConceptUids = getNonExistentRoamUids(conceptUids);
      if (orphanedConceptUids.length > 0) {
        // console.log("Deleting concepts:", orphanedConceptUids);
        await deleteConceptsFromSupabase(
          orphanedConceptUids,
          context.spaceId,
          supabaseClient,
        );
      }
    }

    const contentUids = await getAllContentLocalIdsFromSupabase(
      supabaseClient,
      context.spaceId,
    );
    if (contentUids.length > 0) {
      const orphanedContentUids = getNonExistentRoamUids(contentUids);
      if (orphanedContentUids.length > 0) {
        // console.log("Deleting content:", orphanedContentUids);
        await deleteContentFromSupabase(
          orphanedContentUids,
          context.spaceId,
          supabaseClient,
        );
      }
    }
    const documentUids = await getAllDocumentLocalIdsFromSupabase(
      supabaseClient,
      context.spaceId,
    );
    if (documentUids.length > 0) {
      const orphanedDocumentUids = getNonExistentRoamUids(documentUids);
      if (orphanedDocumentUids.length > 0) {
        // console.log("Deleting documents:", orphanedDocumentUids);
        await deleteDocumentsFromSupabase(
          orphanedDocumentUids,
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
        // console.log("Deleting schemas:", orphanedSchemaUids);
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
