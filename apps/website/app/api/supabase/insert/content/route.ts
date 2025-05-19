import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils"; // Ensure path is correct
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils"; // Ensure path is correct
import cors from "~/utils/llm/cors";

// Based on the Content table schema and usage in embeddingWorkflow.ts
type ContentDataInput = {
  text: string;
  scale: string;
  space_id: number;
  author_id: number;
  source_local_id?: string;
  metadata?: Record<string, unknown> | string; // Allow string for pre-stringified metadata
  created: string; // ISO 8601 date string
  last_modified: string; // ISO 8601 date string
  document_id?: number;
  part_of_id?: number;
};

type ContentRecord = {
  id: number;
  text: string;
  scale: string;
  space_id: number;
  author_id: number;
  source_local_id: string | null;
  metadata: Record<string, unknown> | null;
  created: string;
  last_modified: string;
  document_id: number | null;
  part_of_id: number | null;
  // Add other fields from your Content table if they are selected
};

// Renamed and refactored
const processAndUpsertContentEntry = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ContentDataInput,
): Promise<GetOrCreateEntityResult<ContentRecord>> => {
  const {
    text,
    scale,
    space_id,
    author_id,
    source_local_id,
    metadata: rawMetadata,
    created,
    last_modified,
    document_id,
    part_of_id,
  } = data;

  // --- Start of extensive validation ---
  if (!text || typeof text !== "string")
    return {
      entity: null,
      error: "Invalid or missing text.",
      created: false,
      status: 400,
    };
  if (!scale || typeof scale !== "string")
    return {
      entity: null,
      error: "Invalid or missing scale.",
      created: false,
      status: 400,
    };
  if (
    space_id === undefined ||
    space_id === null ||
    typeof space_id !== "number"
  )
    return {
      entity: null,
      error: "Invalid or missing space_id.",
      created: false,
      status: 400,
    };
  if (
    author_id === undefined ||
    author_id === null ||
    typeof author_id !== "number"
  )
    return {
      entity: null,
      error: "Invalid or missing author_id.",
      created: false,
      status: 400,
    };
  if (!created)
    return {
      entity: null,
      error: "Missing created date.",
      created: false,
      status: 400,
    };
  if (!last_modified)
    return {
      entity: null,
      error: "Missing last_modified date.",
      created: false,
      status: 400,
    };

  try {
    new Date(created); // Validate date format
    new Date(last_modified); // Validate date format
  } catch (e) {
    return {
      entity: null,
      error: "Invalid date format for created or last_modified.",
      created: false,
      status: 400,
    };
  }
  // --- End of extensive validation ---

  const processedMetadata =
    rawMetadata && typeof rawMetadata === "object"
      ? JSON.stringify(rawMetadata)
      : typeof rawMetadata === "string"
        ? rawMetadata
        : null;

  const supabase = await supabasePromise;

  const contentToInsertOrUpdate = {
    text,
    scale,
    space_id,
    author_id,
    source_local_id: source_local_id || null,
    metadata: processedMetadata as any,
    created,
    last_modified,
    document_id: document_id || null,
    part_of_id: part_of_id || null,
  };

  let matchCriteria: Record<string, any> | null = null;
  if (source_local_id && space_id !== undefined && space_id !== null) {
    matchCriteria = { space_id: space_id, source_local_id: source_local_id };
  }
  // If no solid matchCriteria for a "get", getOrCreateEntity will likely proceed to "create".
  // If there are unique constraints other than (space_id, source_local_id), it will handle race conditions.

  const result = await getOrCreateEntity<ContentRecord>(
    supabase,
    "Content",
    "*", // Select all fields for ContentRecord
    matchCriteria || { id: -1 }, // Use a non-matching criteria if no specific lookup needed, to force create path if not found
    contentToInsertOrUpdate, // This will be used for insert if not found or for update in some extended utilities.
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
        error: `Invalid space_id: No DiscourseSpace record found for ID ${space_id}.`,
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
