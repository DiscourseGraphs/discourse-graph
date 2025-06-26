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
  
    // TODO - Later we need to delete a discoursenode's concept, content and document 
    const { error, count } = await supabase
      .from("Document")
      .delete({ count: "exact" })
      .eq("space_id", spaceId)
      .in("source_local_id", uids);

    if (error) {
      return createApiResponse(
        request,
        asPostgrestFailure(error.message, error.code, 500),
      );
    }

    const response = NextResponse.json({ count }, { status: 200 });
    return cors(request, response) as NextResponse;
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/delete-discourse-nodes");
  }
};

export const OPTIONS = defaultOptionsHandler;
