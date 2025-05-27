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
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

export type ContentDataInput = TablesInsert<"Content">;
export type ContentRecord = Tables<"Content">;

export const inputValidation: ItemValidator<ContentDataInput> = (
  data: ContentDataInput,
) => {
  if (!data || typeof data !== "object")
    return "Invalid request body: expected a JSON object.";
  const { author_id, created, last_modified, scale, space_id, text } = data;

  if (!text || typeof text !== "string") return "Invalid or missing text.";
  if (!scale || typeof scale !== "string") return "Invalid or missing scale.";
  if (
    space_id === undefined ||
    space_id === null ||
    typeof space_id !== "number"
  )
    return "Invalid or missing space_id.";
  if (
    author_id === undefined ||
    author_id === null ||
    typeof author_id !== "number"
  )
    return "Invalid or missing author_id.";
  if (created)
    try {
      new Date(created);
    } catch (e) {
      return "Invalid date format for created.";
    }
  if (last_modified)
    try {
      new Date(last_modified);
    } catch (e) {
      return "Invalid date format for last_modified.";
    }
  return null;
};

const processAndUpsertContentEntry = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ContentDataInput,
): Promise<GetOrCreateEntityResult<ContentRecord>> => {
  const { space_id, author_id, source_local_id, document_id, part_of_id } =
    data;

  const error = inputValidation(data);
  if (error !== null) {
    return {
      entity: null,
      error,
      created: false,
      status: 400,
    };
  }

  const supabase = await supabasePromise;

  let matchCriteria: Record<string, any> | null = null;
  if (source_local_id && space_id !== undefined && space_id !== null) {
    matchCriteria = { space_id: space_id, source_local_id: source_local_id };
  }
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
    return handleRouteError(request, e, "/api/supabase/insert/content");
  }
};

export const OPTIONS = defaultOptionsHandler;
