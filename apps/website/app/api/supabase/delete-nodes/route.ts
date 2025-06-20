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

    if (!spaceId || typeof spaceId !== "number") {
      return createApiResponse(
        request,
        asPostgrestFailure(
          "Missing or invalid required field: spaceId (number)",
          "invalid",
        ),
      );
    }

    if (!uids || !Array.isArray(uids) || uids.length === 0) {
      return createApiResponse(
        request,
        asPostgrestFailure(
          "Missing or invalid required field: uids (array of strings)",
          "invalid",
        ),
      );
    }

    const supabase = await createClient();

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
    return handleRouteError(request, e, "/api/supabase/delete-nodes");
  }
};

export const OPTIONS = defaultOptionsHandler;
