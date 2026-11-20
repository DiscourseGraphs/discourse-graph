import type { NextResponse, NextRequest } from "next/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  defaultOptionsHandler,
  createApiResponse,
} from "~/utils/supabase/apiUtils";
import { nodePathFromRid } from "~/utils/conversion/nodeAddress";
import { nodeDataResponse } from "~/api/data/nodeData";

// Looks a node up by RID. The response is the node itself, not a redirect;
// its address is in the `Content-Location` header.
export const GET = async (request: NextRequest): Promise<NextResponse> => {
  const rid = request.nextUrl.searchParams.get("rid");
  if (!rid)
    return createApiResponse(
      request,
      asPostgrestFailure("Missing rid parameter", "400", 400),
    );
  const nodePath = nodePathFromRid(rid);
  if (!nodePath)
    return createApiResponse(
      request,
      asPostgrestFailure(`Unrecognized rid ${rid}`, "404", 404),
    );
  return nodeDataResponse({ request, nodePath });
};

export const OPTIONS = defaultOptionsHandler;
