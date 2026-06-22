import { NextResponse, type NextRequest } from "next/server";
import type {
  ContentResolveRequest,
  ContentResolveRow,
} from "@repo/database/lib/contentApi";
import {
  createApiResponse,
  defaultOptionsHandler,
  handleRouteError,
} from "~/utils/supabase/apiUtils";
import cors from "~/utils/llm/cors";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import { createRequestSupabaseClient } from "~/utils/supabase/requestClient";

const validateRequest = (body: ContentResolveRequest): string | null => {
  if (!body || typeof body !== "object")
    return "Request body must be an object.";
  if (!Number.isInteger(body.spaceId)) return "spaceId must be an integer.";
  if (!Array.isArray(body.requests)) return "requests must be an array.";
  if (
    body.requests.some(
      (item) =>
        typeof item.source_local_id !== "string" ||
        typeof item.variant !== "string" ||
        typeof item.content_type !== "string",
    )
  ) {
    return "Each request must include source_local_id, variant, and content_type.";
  }
  return null;
};

const requestKey = (item: {
  source_local_id: string | null;
  variant: string | null;
  content_type: string | null;
}): string =>
  `${item.source_local_id ?? ""}\t${item.variant ?? ""}\t${item.content_type ?? ""}`;

const createResolveResponse = (
  request: NextRequest,
  rows: ContentResolveRow[],
): NextResponse => cors(request, NextResponse.json(rows)) as NextResponse;

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  try {
    const body = (await request.json()) as ContentResolveRequest;
    const validationError = validateRequest(body);
    if (validationError) {
      return createApiResponse(
        request,
        asPostgrestFailure(validationError, "invalid"),
      );
    }
    if (body.requests.length === 0) {
      return createResolveResponse(request, []);
    }

    const supabase = createRequestSupabaseClient(request);
    const sourceLocalIds = [
      ...new Set(body.requests.map((item) => item.source_local_id)),
    ];
    const variants = [...new Set(body.requests.map((item) => item.variant))];
    const contentTypes = [
      ...new Set(body.requests.map((item) => item.content_type)),
    ];
    const requestedKeys = new Set(body.requests.map(requestKey));

    const result = await supabase
      .from("my_contents")
      .select(
        "id, source_local_id, space_id, text, created, last_modified, variant, content_type, metadata, author_id",
      )
      .eq("space_id", body.spaceId)
      .in("source_local_id", sourceLocalIds)
      .in("variant", variants)
      .in("content_type", contentTypes);

    if (result.error) {
      return createApiResponse(request, result);
    }

    const rows = ((result.data ?? []) as ContentResolveRow[]).filter((row) =>
      requestedKeys.has(requestKey(row)),
    );

    return createResolveResponse(request, rows);
  } catch (error: unknown) {
    return handleRouteError(request, error, "/api/supabase/content/resolve");
  }
};

export const OPTIONS = defaultOptionsHandler;
