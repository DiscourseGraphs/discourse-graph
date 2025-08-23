import { NextResponse, NextRequest } from "next/server";
import type { PostgrestResponse } from "@supabase/supabase-js";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { validateAndInsertBatch } from "~/utils/supabase/dbUtils";
import {
  contentInputValidation,
  type ContentDataInput,
  type ContentRecord,
} from "~/utils/supabase/validators";

const batchInsertContentProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentItems: ContentDataInput[],
): Promise<PostgrestResponse<ContentRecord>> => {
  return validateAndInsertBatch<"Content">({
    supabase,
    tableName: "Content",
    items: contentItems,
    uniqueOn: ["space_id", "source_local_id"],
    inputValidator: contentInputValidation,
  });
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createClient();

  try {
    const body: ContentDataInput[] = await request.json();
    if (!Array.isArray(body)) {
      return createApiResponse(
        request,
        asPostgrestFailure(
          "Request body must be an array of content items.",
          "array",
        ),
      );
    }

    const result = await batchInsertContentProcess(supabase, body);

    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/content/batch");
  }
};

export const OPTIONS = defaultOptionsHandler;
