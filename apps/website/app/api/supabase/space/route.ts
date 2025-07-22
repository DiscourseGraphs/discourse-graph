import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { fetchOrCreateSpaceDirect } from "@repo/ui/lib/supabase/contextFunctions";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = await request.json();
    const result = await fetchOrCreateSpaceDirect(body);
    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/space");
  }
};

export const OPTIONS = defaultOptionsHandler;
