import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
  ItemValidator,
} from "~/utils/supabase/dbUtils"; // Ensure path is correct
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils"; // Ensure path is correct
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

export type ContentDataInput = TablesInsert<"Content">;
export type ContentRecord = Tables<"Content">;

export const inputValidation: ItemValidator<ContentDataInput> = (
  data: ContentDataInput,
) => {
  const { author_id, created, last_modified, scale, space_id, text } = data;

  // --- Start of extensive validation ---
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
      new Date(created); // Validate date format
    } catch (e) {
      return "Invalid date format for created.";
    }
  if (last_modified)
    try {
      new Date(last_modified); // Validate date format
    } catch (e) {
      return "Invalid date format for last_modified.";
    }
  // --- End of extensive validation ---

  return null;
};

// Renamed and refactored
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

  const result = await getOrCreateEntity<"Content">(
    supabase,
    "Content",
    "*", // Select all fields for ContentRecord
    matchCriteria || { id: -1 }, // Use a non-matching criteria if no specific lookup needed, to force create path if not found
    data, // This will be used for insert if not found or for update in some extended utilities.
    "Content",
  );

  // Custom handling for specific foreign key errors
  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    const details = result.details.toLowerCase();
    if (
      details.includes("content_space_id_fkey") ||
      details.includes("space_id")
    ) {
      // Be more general with FK name if it changes
      return {
        ...result,
        error: `Invalid space_id: No Space record found for ID ${space_id}.`,
      };
    }
    if (
      details.includes("content_author_id_fkey") ||
      details.includes("author_id")
    ) {
      return {
        ...result,
        error: `Invalid author_id: No Account record found for ID ${author_id}.`,
      };
    }
    if (
      document_id &&
      (details.includes("content_document_id_fkey") ||
        details.includes("document_id"))
    ) {
      return {
        ...result,
        error: `Invalid document_id: No Document record found for ID ${document_id}.`,
      };
    }
    if (
      part_of_id &&
      (details.includes("content_part_of_id_fkey") ||
        details.includes("part_of_id"))
    ) {
      return {
        ...result,
        error: `Invalid part_of_id: No Content record found for ID ${part_of_id}.`,
      };
    }
  }
  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: ContentDataInput = await request.json();

    // Most validation is now inside processAndUpsertContentEntry
    // Minimal check here, or rely on processAndUpsertContentEntry for all field validation
    if (!body || typeof body !== "object") {
      return createApiResponse(request, {
        error: "Invalid request body: expected a JSON object.",
        status: 400,
      });
    }

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
