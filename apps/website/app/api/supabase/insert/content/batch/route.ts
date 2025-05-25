import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  validateAndInsertBatch,
  BatchProcessResult, // Import BatchProcessResult for the return type
} from "~/utils/supabase/dbUtils"; // Ensure this path is correct
import {
  inputValidation,
  type ContentDataInput,
  type ContentRecord,
} from "~/api/supabase/insert/content/route";

// Updated batchInsertContentProcess to use the generic utility
const batchInsertContentProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentItems: ContentDataInput[],
): Promise<BatchProcessResult<ContentRecord>> => {
  return validateAndInsertBatch<"Content">(
    supabase,
    contentItems,
    "Content", // Table name
    "*", // Select query (can be more specific, e.g., "id, text, scale, ...")
    "Content", // Entity name for logging
    inputValidation,
    null,
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createClient();

  try {
    const body: ContentDataInput[] = await request.json();
    if (!Array.isArray(body)) {
      return createApiResponse(request, {
        error: "Request body must be an array of content items.",
        status: 400,
      });
    }

    const result = await batchInsertContentProcess(supabase, body);

    return createApiResponse(request, {
      data: result.data,
      error: result.error,
      details: result.details,
      ...(result.partial_errors && {
        meta: { partial_errors: result.partial_errors },
      }),
      status: result.status,
      created: result.status === 201,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/content/batch");
  }
};

export const OPTIONS = defaultOptionsHandler;
