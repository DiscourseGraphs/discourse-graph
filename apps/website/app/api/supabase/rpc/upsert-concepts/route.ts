import { NextRequest, NextResponse } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import cors from "~/utils/llm/cors";

type ConceptsRequest = {
  v_space_id: number;
  data: any[];
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body: ConceptsRequest = await request.json();
    const { v_space_id, data } = body;

    const supabase = await createClient();

    const rpcResponse = await supabase.rpc("upsert_concepts", {
      v_space_id,
      data,
    });

    return createApiResponse(request, rpcResponse);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/rpc/upsert-concepts");
  }
};

export const OPTIONS = defaultOptionsHandler;
