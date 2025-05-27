import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  validateAndInsertBatch,
  BatchProcessResult,
} from "~/utils/supabase/dbUtils";
import {
  inputValidation,
  type ContentDataInput,
  type ContentRecord,
} from "~/api/supabase/content/route";

const batchInsertContentProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentItems: ContentDataInput[],
): Promise<BatchProcessResult<ContentRecord>> => {
  return validateAndInsertBatch<"Content">({
    supabase,
    tableName: "Content",
    items: contentItems,
    uniqueOn: ["space_id", "source_local_id"],
    inputValidator: inputValidation,
  });
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
    return handleRouteError(request, e, "/api/supabase/content/batch");
  }
};

export const OPTIONS = defaultOptionsHandler;
