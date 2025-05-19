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
  BatchProcessResult,
} from "~/utils/supabase/dbUtils";
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

type ContentEmbeddingDataInput =
  TablesInsert<"ContentEmbedding_openai_text_embedding_3_small_1536">;
type ContentEmbeddingRecord =
  Tables<"ContentEmbedding_openai_text_embedding_3_small_1536">;

// Request body is an array of these items
type ContentEmbeddingBatchRequestBody = ContentEmbeddingDataInput[];

// Type for the item after processing, ready for DB insert
type ProcessedEmbeddingItem = Omit<ContentEmbeddingDataInput, "vector"> & {
  vector: string; // Vector is always stringified
  obsolete: boolean | null; // Obsolete has a default
};

const TARGET_EMBEDDING_TABLE =
  "ContentEmbedding_openai_text_embedding_3_small_1536";

// Validator and processor for embedding items
const validateAndProcessEmbeddingItem: BatchItemValidator<
  ContentEmbeddingDataInput,
  ProcessedEmbeddingItem
> = (item, index) => {
  if (item.target_id === undefined || item.target_id === null) {
    return {
      valid: false,
      error: `Item at index ${index}: Missing required field target_id.`,
    };
  }
  if (!item.model) {
    return {
      valid: false,
      error: `Item at index ${index}: Missing required field model.`,
    };
  }
  if (!item.vector) {
    return {
      valid: false,
      error: `Item at index ${index}: Missing required field vector.`,
    };
  }
  if (!Array.isArray(item.vector) && typeof item.vector !== "string") {
    return {
      valid: false,
      error: `Item at index ${index}: vector must be an array of numbers or a pre-formatted string.`,
    };
  }

  const vectorString = Array.isArray(item.vector)
    ? JSON.stringify(item.vector)
    : item.vector;

  return {
    valid: true,
    processedItem: {
      target_id: item.target_id,
      model: item.model,
      vector: vectorString,
      obsolete: item.obsolete === undefined ? false : item.obsolete,
    },
  };
};

const batchInsertEmbeddingsProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  embeddingItems: ContentEmbeddingBatchRequestBody,
): Promise<BatchProcessResult<ContentEmbeddingRecord>> => {
  return processAndInsertBatch<
    "ContentEmbedding_openai_text_embedding_3_small_1536",
    ProcessedEmbeddingItem
  >(
    supabase,
    embeddingItems,
    TARGET_EMBEDDING_TABLE,
    "*", // Select all fields, adjust if needed for ContentEmbeddingRecord
    validateAndProcessEmbeddingItem,
    "ContentEmbedding",
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createClient();

  try {
    const body: ContentEmbeddingBatchRequestBody = await request.json();
    if (!Array.isArray(body)) {
      return createApiResponse(request, {
        error: "Request body must be an array of embedding items.",
        status: 400,
      });
    }

    const result = await batchInsertEmbeddingsProcess(supabase, body);

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
    return handleRouteError(
      request,
      e,
      `/api/supabase/insert/${TARGET_EMBEDDING_TABLE}/batch`,
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
