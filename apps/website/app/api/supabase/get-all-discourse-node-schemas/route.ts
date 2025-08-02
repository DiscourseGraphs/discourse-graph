import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import cors from "~/utils/llm/cors";

type NodeSchemasRequest = {
  spaceId: number;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body: NodeSchemasRequest = await request.json();
    const { spaceId } = body;

    const supabase = await createClient();

    const conceptResponse = await supabase
      .from("Concept")
      .select(
        `
        Content!inner (
            source_local_id
        )
      `,
      )
      .eq("space_id", spaceId)
      .eq("is_schema", true)
      // Node schemas have arity 0 (relations have arity > 0)
      .eq("arity", 0)
      .not("Content.source_local_id", "is", null);

    if (conceptResponse.error) {
      return createApiResponse(request, conceptResponse);
    }

    const result =
      conceptResponse.data
        ?.map((c) => c.Content?.source_local_id)
        .filter((id): id is string => !!id) || [];

    const response = NextResponse.json(result, { status: 200 });
    return cors(request, response) as NextResponse;
  } catch (e: unknown) {
    return handleRouteError(
      request,
      e,
      "/api/supabase/get-all-discourse-node-schemas",
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
