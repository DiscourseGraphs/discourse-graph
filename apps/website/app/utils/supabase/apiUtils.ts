import { NextResponse, NextRequest } from "next/server";
import cors from "~/utils/llm/cors"; // Assuming this path is correct and accessible
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
export function createApiResponse<T>(
  request: NextRequest,
  payload: {
    data?: T | null;
    error?: string | null;
    details?: string | null;
    status: number;
    created?: boolean;
  },
): NextResponse {
  let response: NextResponse;
  const { data, error, details, status, created } = payload;

  if (error) {
    // console.error(`API Error (status ${status}): ${error}`, details || ""); // Logging done by callers or specific error handlers
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
}

/**
 * Handles errors caught in the main try-catch block of an API route.
 * Differentiates JSON parsing errors from other errors.
 */
export function handleRouteError(
  request: NextRequest,
  error: unknown,
  routeName: string,
): NextResponse {
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
}

export const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error(
    "Missing OPENAI_API_KEY environment variable. The embeddings API will not function.",
  );
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

/**
 * Default OPTIONS handler for CORS preflight requests.
 */
export async function defaultOptionsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}

const OPENAI_REQUEST_TIMEOUT_MS = 30000;

async function openai_embedding(
  input: string | string[],
  model: string,
  dimensions?: number,
): Promise<number[] | number[][] | undefined> {
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
}

export async function generic_embedding(
  input: string | string[],
  model: string,
  provider: string,
  dimensions?: number,
): Promise<number[] | number[][] | undefined> {
  provider = provider || "openai";
  if (provider == "openai") {
    return await openai_embedding(input, model, dimensions);
  }
}
