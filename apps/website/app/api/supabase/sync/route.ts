import { NextResponse, NextRequest } from "next/server";

import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();
    const { spaceId } = body;

    if (!spaceId || typeof spaceId !== "number") {
      return createApiResponse(
        request,
        asPostgrestFailure("Missing or invalid spaceId", "invalid"),
      );
    }

    const supabase = await supabasePromise;

    const result = await supabase
      .from("sync_info")
      .select("last_task_end")
      .eq("sync_target", spaceId)
      .maybeSingle();

    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/sync");
  }
};

export const OPTIONS = defaultOptionsHandler;
