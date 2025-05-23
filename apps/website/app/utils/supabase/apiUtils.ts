import { NextResponse, NextRequest } from "next/server";
import {
  PostgrestResponse,
  PostgrestSingleResponse,
} from "@supabase/supabase-js";

import { Database } from "@repo/database/types.gen.ts";
import { createClient } from "~/utils/supabase/server";
import cors from "~/utils/llm/cors";
import OpenAI from "openai";

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

export const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
  console.error(
    "Missing OPENAI_API_KEY environment variable. The embeddings API will not function.",
  );
}

const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null;

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
    const idN = Number.parseInt(id);
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
    const idN = Number.parseInt(id);
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

const OPENAI_REQUEST_TIMEOUT_MS = 30000;

const openaiEmbedding = async (
  input: string | string[],
  model: string,
  dimensions?: number,
): Promise<number[] | number[][] | undefined> => {
  if (!openai) {
    throw new Error("OpenAI client not initialized. Check OPENAI_API_KEY.");
  }

  let options: OpenAI.EmbeddingCreateParams = {
    model,
    input,
  };
  if (dimensions) {
    options = { ...options, ...{ dimensions } };
  }

  const embeddingsPromise = openai!.embeddings.create(options);
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error("OpenAI API request timeout")),
      OPENAI_REQUEST_TIMEOUT_MS,
    ),
  );

  const response = await Promise.race([embeddingsPromise, timeoutPromise]);
  const embeddings = response.data.map((d) => d.embedding);
  if (Array.isArray(input)) return embeddings;
  else return embeddings[0];
};

export const genericEmbedding = async (
  input: string | string[],
  model: string,
  provider: string,
  dimensions?: number,
): Promise<number[] | number[][] | undefined> => {
  provider = provider || "openai";
  if (provider == "openai") {
    return await openaiEmbedding(input, model, dimensions);
  }
};
