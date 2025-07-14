import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import cors from "~/utils/llm/cors";
import { PostgrestSingleResponse } from "@supabase/supabase-js";

type DeleteNodeSchemasRequest = {
  spaceId: number;
  uids: string[];
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body: DeleteNodeSchemasRequest = await request.json();
    const { spaceId, uids } = body;

    if (uids.length === 0) {
      const response = NextResponse.json({ count: 0 }, { status: 200 });
      return cors(request, response) as NextResponse;
    }

    const supabase = await createClient();

    /* ------------------------------------------------------------------
     * 1. Find Content rows that represent the node-schema blocks we want to delete
     * ------------------------------------------------------------------ */
    const { data: schemaContentData, error: contentLookupError } =
      await supabase
        .from("Content")
        .select("id, source_local_id")
        .eq("space_id", spaceId)
        .in("source_local_id", uids);

    if (contentLookupError) {
      return createApiResponse(
        request,
        asPostgrestFailure(
          contentLookupError.message,
          contentLookupError.code,
          500,
        ),
      );
    }

    if (!schemaContentData || schemaContentData.length === 0) {
      // Nothing to delete
      const response = NextResponse.json({ count: 0 }, { status: 200 });
      return cors(request, response) as NextResponse;
    }

    const schemaContentIds = schemaContentData.map((c) => c.id);

    /* ------------------------------------------------------------------
     * 2. Find the Concept rows that define these node schemas
     * ------------------------------------------------------------------ */
    const { data: schemaConceptData, error: schemaConceptError } =
      await supabase
        .from("Concept")
        .select("id")
        .eq("space_id", spaceId)
        .eq("is_schema", true)
        .in("represented_by_id", schemaContentIds);

    if (schemaConceptError) {
      return createApiResponse(
        request,
        asPostgrestFailure(
          schemaConceptError.message,
          schemaConceptError.code,
          500,
        ),
      );
    }

    const schemaConceptIds = (schemaConceptData || []).map((c) => c.id);

    /* ------------------------------------------------------------------
     * 3. Find *instance* Concepts (and their Content) that reference those schemas
     * ------------------------------------------------------------------ */
    let instanceConceptIds: number[] = [];
    let instanceContentIds: number[] = [];
    let instanceSourceLocalIds: string[] = [];

    if (schemaConceptIds.length > 0) {
      const { data: instanceConceptData, error: instanceConceptError } =
        await supabase
          .from("Concept")
          .select("id, represented_by_id")
          .eq("space_id", spaceId)
          .eq("is_schema", false)
          .in("schema_id", schemaConceptIds);

      if (instanceConceptError) {
        return createApiResponse(
          request,
          asPostgrestFailure(
            instanceConceptError.message,
            instanceConceptError.code,
            500,
          ),
        );
      }

      instanceConceptIds = (instanceConceptData || []).map((ic) => ic.id);
      instanceContentIds = (instanceConceptData || [])
        .map((ic) => ic.represented_by_id)
        .filter((x): x is number => typeof x === "number");

      // Map instance content ids back to their source_local_id for Document deletion
      if (instanceContentIds.length > 0) {
        const { data: instanceContentData, error: instanceContentLookupError } =
          await supabase
            .from("Content")
            .select("source_local_id")
            .in("id", instanceContentIds);

        if (instanceContentLookupError) {
          return createApiResponse(
            request,
            asPostgrestFailure(
              instanceContentLookupError.message,
              instanceContentLookupError.code,
              500,
            ),
          );
        }
        instanceSourceLocalIds = (instanceContentData || [])
          .map((c) => c.source_local_id)
          .filter((id): id is string => !!id);
      }
    }

    /* ------------------------------------------------------------------
     * 4. Delete instance Concepts first (they depend on the schemas)
     * ------------------------------------------------------------------ */
    if (instanceConceptIds.length > 0) {
      const { error: deleteInstanceConceptError } = await supabase
        .from("Concept")
        .delete()
        .in("id", instanceConceptIds);

      if (deleteInstanceConceptError) {
        return createApiResponse(
          request,
          asPostgrestFailure(
            deleteInstanceConceptError.message,
            deleteInstanceConceptError.code,
            500,
          ),
        );
      }
    }

    /* ------------------------------------------------------------------
     * 5. Delete schema Concepts themselves
     * ------------------------------------------------------------------ */
    if (schemaConceptIds.length > 0) {
      const { error: deleteSchemaConceptError } = await supabase
        .from("Concept")
        .delete()
        .in("id", schemaConceptIds);

      if (deleteSchemaConceptError) {
        return createApiResponse(
          request,
          asPostgrestFailure(
            deleteSchemaConceptError.message,
            deleteSchemaConceptError.code,
            500,
          ),
        );
      }
    }

    /* ------------------------------------------------------------------
     * 6. Delete Content rows (schemas + instances)
     * ------------------------------------------------------------------ */
    const allContentIds = [...schemaContentIds, ...instanceContentIds];
    if (allContentIds.length > 0) {
      const { error: deleteContentError } = await supabase
        .from("Content")
        .delete()
        .in("id", allContentIds);

      if (deleteContentError) {
        return createApiResponse(
          request,
          asPostgrestFailure(
            deleteContentError.message,
            deleteContentError.code,
            500,
          ),
        );
      }
    }

    /* ------------------------------------------------------------------
     * 7. Delete Document rows corresponding to the schema blocks and their instances
     * ------------------------------------------------------------------ */
    const docLocalIds = [...uids, ...instanceSourceLocalIds];
    let deletedDocsCount = 0;
    if (docLocalIds.length > 0) {
      const { error: docError, count } = await supabase
        .from("Document")
        .delete({ count: "exact" })
        .eq("space_id", spaceId)
        .in("source_local_id", docLocalIds);

      if (docError) {
        return createApiResponse(
          request,
          asPostgrestFailure(docError.message, docError.code, 500),
        );
      }
      deletedDocsCount = count ?? 0;
    }

    const response = NextResponse.json(
      {
        deletedSchemas: schemaContentIds.length,
        deletedInstances: instanceConceptIds.length,
        deletedDocuments: deletedDocsCount,
      },
      { status: 200 },
    );
    return cors(request, response) as NextResponse;
  } catch (e: unknown) {
    return handleRouteError(
      request,
      e,
      "/api/supabase/delete-discourse-node-schemas",
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
