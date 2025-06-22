import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import cors from "~/utils/llm/cors";

type NodesRequest = {
  spaceId: number;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body: NodesRequest = await request.json();
    const { spaceId } = body;

    const supabase = await createClient();

    const documentsResponse = await supabase
      .from("Document")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .not("source_local_id", "is", null);

    if (documentsResponse.error) {
      return createApiResponse(request, documentsResponse);
    }

    const result =
      documentsResponse.data
        ?.filter((doc) => doc.source_local_id)
        .map((doc) => doc.source_local_id) || [];

    const response = NextResponse.json(result, { status: 200 });
    return cors(request, response) as NextResponse;
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/get-all-nodes");
  }
};

export const OPTIONS = defaultOptionsHandler;
