import { NextResponse, NextRequest } from "next/server";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import { createClient } from "~/utils/supabase/server";
import { getOrCreateEntity, ItemValidator } from "~/utils/supabase/dbUtils";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { Tables, TablesInsert } from "@repo/database/dbTypes";

type DocumentDataInput = TablesInsert<"Document">;
type DocumentRecord = Tables<"Document">;

const validateDocument: ItemValidator<DocumentDataInput> = (data) => {
  if (!data || typeof data !== "object")
    return "Invalid request body: expected a JSON object.";
  const { space_id, author_id, source_local_id } = data;

  if (!author_id) return "Missing required author_id field.";
  // Note: Those are only mandatory together.
  if ((space_id === null) !== (source_local_id === null))
    return "Either specify both source_id and source_local_id or neither.";
  return null;
};

const createDocument = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: DocumentDataInput,
): Promise<PostgrestSingleResponse<DocumentRecord>> => {
  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<"Document">({
    supabase,
    tableName: "Document",
    insertData: data,
    // Note: This is a temporary assumption
    // we'll want to have a in-space route with this,
    // and an out-of-space context with url.
    uniqueOn: ["space_id", "source_local_id"],
  });

  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: DocumentDataInput = await request.json();
    const error = validateDocument(body);
    if (error !== null)
      return createApiResponse(request, asPostgrestFailure(error, "invalid"));

    const result = await createDocument(supabasePromise, body);

    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/document");
  }
};

export const OPTIONS = defaultOptionsHandler;
