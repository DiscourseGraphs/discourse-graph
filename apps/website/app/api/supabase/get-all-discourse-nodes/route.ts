import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
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

    const { data: schemas, error: schemasError } = await supabase
      .from("Concept")
      .select("id")
      .eq("space_id", spaceId)
      .eq("is_schema", true)
      // A node schema has arity 0, whereas a relation schema has arity > 0
      .eq("arity", 0);

    if (schemasError) {
      return createApiResponse(
        request,
        asPostgrestFailure(schemasError.message, schemasError.code, 500),
      );
    }
    console.log("data", schemas);

    const schemaIds = schemas.map((s) => s.id);

    console.log("schemaIds", schemaIds);

    if (schemaIds.length === 0) {
      const response = NextResponse.json([], { status: 200 });
      return cors(request, response) as NextResponse;
    }

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
      .eq("is_schema", false)
      .in("schema_id", schemaIds)
      .not("Content.source_local_id", "is", null);

    console.log("conceptResponse", conceptResponse);

    if (conceptResponse.error) {
      return createApiResponse(request, conceptResponse);
    }

    const nodeResult =
      conceptResponse.data
        ?.map((c) => c.Content?.source_local_id)
        .filter((id): id is string => !!id) || [];

    const blockContentResponse = await supabase
      .from("Content")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .eq("scale", "block")
      .not("source_local_id", "is", null);

    if (blockContentResponse.error) {
      return createApiResponse(request, blockContentResponse);
    }

    const blockResult =
      blockContentResponse.data
        ?.map((c) => c.source_local_id)
        .filter((id): id is string => !!id) || [];

    const result = [...new Set([...nodeResult, ...blockResult])];

    const response = NextResponse.json(result, { status: 200 });
    return cors(request, response) as NextResponse;
  } catch (e: unknown) {
    return handleRouteError(
      request,
      e,
      "/api/supabase/get-all-discourse-nodes",
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
