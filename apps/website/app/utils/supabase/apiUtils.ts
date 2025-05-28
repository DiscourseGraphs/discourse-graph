import { NextResponse, NextRequest } from "next/server";
import {
  PostgrestResponse,
  PostgrestSingleResponse,
} from "@supabase/supabase-js";

import { Database } from "./types.gen";
import { createClient } from "~/utils/supabase/server";
import cors from "~/utils/llm/cors";
import { Segment } from "next/dist/server/app-render/types";

/**
 * Sends a standardized JSON response.
 * @param request The original NextRequest.
 * @param data The data payload for successful responses.
 * @param error An error message string if the operation failed.
 * @param details Optional detailed error information.
 * @param status The HTTP status code for the response.
 * @param created A boolean indicating if a resource was created (influences status code: 201 vs 200).
 */
export const createApiResponse = <T>(
  request: NextRequest,
  payload: PostgrestResponse<T> | PostgrestSingleResponse<T>,
): NextResponse => {
  let response: NextResponse;
  const { data, error, status } = payload;

  if (error) {
    response = NextResponse.json(
      { error: error.message, details: error.details || undefined },
      { status },
    );
  } else if (data !== undefined && data !== null) {
    response = NextResponse.json(data, { status });
  } else {
    // Fallback for unexpected state (e.g. no error, but no data for a success status)
    console.error(
      `API Response Error: Attempted to send success response (status ${status}) with no data and no error.`,
    );
    response = NextResponse.json(
      {
        error:
          "An unexpected server error occurred during response generation.",
      },
      { status: 500 },
    );
  }
  return cors(request, response) as NextResponse;
};

/**
 * Handles errors caught in the main try-catch block of an API route.
 * Differentiates JSON parsing errors from other errors.
 */
export const handleRouteError = (
  request: NextRequest,
  error: unknown,
  routeName: string,
): NextResponse => {
  console.error(`API route error in ${routeName}:`, error);
  if (
    error instanceof SyntaxError &&
    error.message.toLowerCase().includes("json")
  ) {
    return createApiResponse(
      request,
      asPostgrestFailure("Invalid JSON in request body.", "invalid"),
    );
  }
  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred processing your request.";
  return createApiResponse(request, asPostgrestFailure(message, "invalid"));
};

/**
 * Default OPTIONS handler for CORS preflight requests.
 */
export const defaultOptionsHandler = async (
  request: NextRequest,
): Promise<NextResponse> => {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
};

type ApiParams = Promise<{ id: string }>;
export type SegmentDataType = { params: ApiParams };

/**
 * Default GET handler for retrieving a resource by Id
 */
export const makeDefaultGetHandler =
  (tableName: keyof Database["public"]["Tables"], pk: string = "id") =>
  async (
    request: NextRequest,
    segmentData: SegmentDataType,
  ): Promise<NextResponse> => {
    const { id } = await segmentData.params;
    const idN = Number.parseInt((Array.isArray(id) ? id[0] : id) || "error");
    if (isNaN(idN)) {
      return createApiResponse(
        request,
        asPostgrestFailure(`${pk} is not a number`, "type"),
      );
    }
    const supabase = await createClient();
    const response = await supabase
      .from(tableName)
      .select()
      .eq(pk, idN)
      .maybeSingle();
    return createApiResponse(request, response);
  };

/**
 * Default DELETE handler for deleting a resource by ID
 */
export const makeDefaultDeleteHandler =
  (tableName: keyof Database["public"]["Tables"], pk: string = "id") =>
  async (
    request: NextRequest,
    segmentData: SegmentDataType,
  ): Promise<NextResponse> => {
    const { id } = await segmentData.params;
    const idN = Number.parseInt((Array.isArray(id) ? id[0] : id) || "error");
    if (isNaN(idN)) {
      return createApiResponse(
        request,
        asPostgrestFailure(`${pk} is not a number`, "type"),
      );
    }
    const supabase = await createClient();

    const response = await supabase.from(tableName).delete().eq(pk, idN);
    return createApiResponse(request, response);
  };

export const asPostgrestFailure = (
  message: string,
  code: string,
  status: number = 400,
): PostgrestSingleResponse<any> => {
  return {
    data: null,
    error: {
      message,
      code,
      details: "",
      hint: "",
      name: code,
    },
    count: null,
    statusText: code,
    status,
  };
};
