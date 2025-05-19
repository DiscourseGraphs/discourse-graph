import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  processAndInsertBatch,
  BatchItemValidator,
  BatchProcessResult, // Import BatchProcessResult for the return type
} from "~/utils/supabase/dbUtils"; // Ensure this path is correct

// Based on the Content table schema and usage in embeddingWorkflow.ts
// This is for a single content item in the batch
type ContentBatchItemInput = {
  text: string;
  scale: string;
  space_id: number;
  author_id: number; // This is Person.id (Agent.id)
  document_id: number;
  source_local_id?: string;
  metadata?: Record<string, unknown> | string | null; // Allow string for pre-stringified, or null
  created: string; // ISO 8601 date string
  last_modified: string; // ISO 8601 date string
  part_of_id?: number;
};

// The request body will be an array of these items
type ContentBatchRequestBody = ContentBatchItemInput[];

// Define a type for the actual record stored in/retrieved from DB for Content
type ContentRecord = {
  id: number;
  text: string;
  scale: string;
  space_id: number;
  author_id: number;
  document_id: number;
  source_local_id: string | null;
  metadata: Record<string, unknown> | null; // Assuming metadata is stored as JSONB
  created: string; // ISO 8601 date string
  last_modified: string; // ISO 8601 date string
  part_of_id: number | null;
  // Add other fields from your Content table if they are selected
};

// Specific validator and processor for Content items
const validateAndProcessContentItem: BatchItemValidator<
  ContentBatchItemInput,
  Omit<ContentBatchItemInput, "metadata"> & { metadata: string | null } // TProcessed type
> = (item, index) => {
  // No need to check for !item here, processAndInsertBatch handles null/undefined items in the array itself
  const requiredFields = [
    "text",
    "scale",
    "space_id",
    "author_id",
    "document_id",
    "created",
    "last_modified",
  ];
  const missingFields = requiredFields.filter(
    (field) => !(item as any)[field] && (item as any)[field] !== 0,
  ); // check for undefined, null, empty string but allow 0
  if (missingFields.length > 0) {
    return {
      valid: false,
      error: `Item at index ${index}: Missing required fields: ${missingFields.join(", ")}.`,
    };
  }

  let metadataString: string | null = null;
  if (item.metadata && typeof item.metadata === "object") {
    metadataString = JSON.stringify(item.metadata);
  } else if (typeof item.metadata === "string") {
    metadataString = item.metadata;
  } // item.metadata can also be null if provided as such, which is fine

  return {
    valid: true,
    processedItem: { ...item, metadata: metadataString },
  };
};

// Updated batchInsertContentProcess to use the generic utility
const batchInsertContentProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentItems: ContentBatchRequestBody,
): Promise<BatchProcessResult<ContentRecord>> => {
  return processAndInsertBatch<
    ContentBatchItemInput,
    Omit<ContentBatchItemInput, "metadata"> & { metadata: string | null },
    ContentRecord
  >(
    supabase,
    contentItems,
    "Content", // Table name
    "*", // Select query (can be more specific, e.g., "id, text, scale, ...")
    validateAndProcessContentItem,
    "Content", // Entity name for logging
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createClient();

  try {
    const body: ContentBatchRequestBody = await request.json();
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
