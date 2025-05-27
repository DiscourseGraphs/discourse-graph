import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import cors from "~/utils/llm/cors";

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
  payload: {
    data?: T | null;
    error?: string | null;
    details?: string | null;
    status: number;
    created?: boolean;
  },
): NextResponse => {
  let response: NextResponse;
  const { data, error, details, status, created } = payload;

  if (error) {
    response = NextResponse.json(
      { error, details: details || undefined },
      { status },
    );
  } else if (data !== undefined && data !== null) {
    const effectiveStatus = created ? 201 : status === 201 ? 200 : status;
    response = NextResponse.json(data, { status: effectiveStatus });
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
    return createApiResponse(request, {
      error: "Invalid JSON in request body.",
      status: 400,
    });
  }
  const message =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred processing your request.";
  return createApiResponse(request, {
    error: message,
    status: 500,
  });
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
export const defaultGetHandler = async (
  request: NextRequest,
  segmentData: SegmentDataType,
  pk: string = "id",
): Promise<NextResponse> => {
  const { id } = await segmentData.params;
  let idN: number;
  try {
    idN = Number.parseInt((Array.isArray(id) ? id[0] : id) || "error");
  } catch (error) {
    return createApiResponse(request, {
      error: `${pk} is not a number`,
      status: 400,
    });
  }
  const supabase = await createClient();

  const { data, error, status } = await supabase
    .from("Person")
    .select()
    .eq(pk, idN)
    .maybeSingle();
  if (error) {
    return createApiResponse(request, {
      error: error.message,
      status,
    });
  }
  if (status == 404) {
    return createApiResponse(request, {
      error: "Not found",
      status,
    });
  }

  return createApiResponse(request, {
    data,
    status,
  });
};

/**
 * Default DELETE handler for deleting a resource by ID
 */
export const defaultDeleteHandler = async (
  request: NextRequest,
  segmentData: SegmentDataType,
  pk: string = "id",
): Promise<NextResponse> => {
  const { id } = await segmentData.params;
  let idN: number;
  try {
    idN = Number.parseInt((Array.isArray(id) ? id[0] : id) || "error");
  } catch (error) {
    return createApiResponse(request, {
      error: `${pk} is not a number`,
      status: 400,
    });
  }
  const supabase = await createClient();

  const { error, status } = await supabase.from("Person").delete().eq(pk, idN);
  if (error) {
    return createApiResponse(request, {
      error: error.message,
      status,
    });
  }
  if (status == 404) {
    return createApiResponse(request, {
      error: "Not found",
      status,
    });
  }

  return createApiResponse(request, {
    status,
  });
};
