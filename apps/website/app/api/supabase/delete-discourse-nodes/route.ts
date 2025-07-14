import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import cors from "~/utils/llm/cors";

type DeleteNodesRequest = {
  spaceId: number;
  uids: string[];
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body: DeleteNodesRequest = await request.json();
    const { spaceId, uids } = body;
    const supabase = await createClient();

    const { data: contentData, error: contentError } = await supabase
      .from("Content")
      .select("id")
      .eq("space_id", spaceId)
      .in("source_local_id", uids);

    if (contentError) {
      return createApiResponse(
        request,
        asPostgrestFailure(contentError.message, contentError.code, 500),
      );
    }

    const contentIds = contentData.map((c) => c.id);

    if (contentIds.length > 0) {
      const { error: conceptError } = await supabase
        .from("Concept")
        .delete()
        .in("represented_by_id", contentIds)
        .eq("is_schema", false);

      if (conceptError) {
        return createApiResponse(
          request,
          asPostgrestFailure(conceptError.message, conceptError.code, 500),
        );
      }
    }

    // TODO - Later we need to delete a discoursenode's content
    const { error: docError, count } = await supabase
      .from("Document")
      .delete({ count: "exact" })
      .eq("space_id", spaceId)
      .in("source_local_id", uids);

    if (docError) {
      return createApiResponse(
        request,
        asPostgrestFailure(docError.message, docError.code, 500),
      );
    }

    const response = NextResponse.json({ count }, { status: 200 });
    return cors(request, response) as NextResponse;
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/delete-discourse-nodes");
  }
};

export const OPTIONS = defaultOptionsHandler;
