import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
  ItemValidator,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { contentInputValidation } from "~/utils/supabase/validators";
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

type ContentDataInput = TablesInsert<"Content">;
type ContentRecord = Tables<"Content">;

const processAndUpsertContentEntry = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ContentDataInput,
): Promise<GetOrCreateEntityResult<ContentRecord>> => {
  const error = contentInputValidation(data);
  if (error !== null) {
    return {
      entity: null,
      error,
      created: false,
      status: 400,
    };
  }

  const supabase = await supabasePromise;

  // If no solid matchCriteria for a "get", getOrCreateEntity will likely proceed to "create".
  // If there are unique constraints other than (space_id, source_local_id), it will handle race conditions.

  const result = await getOrCreateEntity<"Content">({
    supabase,
    tableName: "Content",
    insertData: data,
    uniqueOn: ["space_id", "source_local_id"],
  });

  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: ContentDataInput = await request.json();
    const result = await processAndUpsertContentEntry(supabasePromise, body);

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/content");
  }
};

export const OPTIONS = defaultOptionsHandler;
