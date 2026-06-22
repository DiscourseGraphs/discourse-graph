import { NextResponse, type NextRequest } from "next/server";
import type { ContentUpsertRequest } from "@repo/database/lib/contentApi";
import type { Json } from "@repo/database/dbTypes";
import {
  createApiResponse,
  defaultOptionsHandler,
  handleRouteError,
} from "~/utils/supabase/apiUtils";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import { createRequestSupabaseClient } from "~/utils/supabase/requestClient";

const validateRequest = (body: ContentUpsertRequest): string | null => {
  if (!body || typeof body !== "object")
    return "Request body must be an object.";
  if (!Number.isInteger(body.spaceId)) return "spaceId must be an integer.";
  if (!Number.isInteger(body.creatorId)) return "creatorId must be an integer.";
  if (!Array.isArray(body.data)) return "data must be an array.";
  return null;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = (await request.json()) as ContentUpsertRequest;
    const validationError = validateRequest(body);
    if (validationError) {
      return createApiResponse(
        request,
        asPostgrestFailure(validationError, "invalid"),
      );
    }

    const supabase = createRequestSupabaseClient(request);
    const result = await supabase.rpc("upsert_content", {
      v_space_id: body.spaceId,
      v_creator_id: body.creatorId,
      content_as_document: body.contentAsDocument ?? true,
      data: body.data as unknown as Json,
    });

    return createApiResponse(request, result);
  } catch (error: unknown) {
    return handleRouteError(request, error, "/api/supabase/content/upsert");
  }
};

export const OPTIONS = defaultOptionsHandler;
