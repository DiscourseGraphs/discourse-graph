import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
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

const ContentEmbeddingBatchItemSchema = z.object({
  target_id: z.number().int().positive(),
  model: z.string().min(1, { message: "Model name cannot be empty." }),
  vector: z.union([
    z.array(z.number()),
    z.string().refine(
      (val) => {
        try {
          const parsed = JSON.parse(val);
          return (
            Array.isArray(parsed) && parsed.every((n) => typeof n === "number")
          );
        } catch (e) {
          return false;
        }
      },
      {
        message: "Vector, if a string, must be a valid JSON array of numbers.",
      },
    ),
  ]),
  obsolete: z.boolean().optional().default(false),
});

const ContentEmbeddingBatchRequestBodySchema = z
  .array(ContentEmbeddingBatchItemSchema)
  .nonempty({
    message: "Request body must be a non-empty array of embedding items.",
  });

type ContentEmbeddingBatchItemInput = z.infer<
  typeof ContentEmbeddingBatchItemSchema
>;
type ContentEmbeddingBatchRequestBody = z.infer<
  typeof ContentEmbeddingBatchRequestBodySchema
>;

interface ContentEmbeddingRecord {
  id: number;
  target_id: number;
  model: string;
  vector: string;
  obsolete: boolean;
}

type ProcessedEmbeddingItem = Omit<ContentEmbeddingBatchItemInput, "vector"> & {
  vector: string;
  obsolete: boolean;
};

const TARGET_EMBEDDING_TABLE =
  "ContentEmbedding_openai_text_embedding_3_small_1536";

const validateAndProcessEmbeddingItem: BatchItemValidator<
  ContentEmbeddingBatchItemInput,
  ProcessedEmbeddingItem
> = (item, _index) => {
  const vectorString = Array.isArray(item.vector)
    ? JSON.stringify(item.vector)
    : item.vector;

  return {
    valid: true,
    processedItem: {
      target_id: item.target_id,
      model: item.model,
      vector: vectorString,
      obsolete: item.obsolete,
    },
  };
};

const batchInsertEmbeddingsProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  embeddingItems: ContentEmbeddingBatchRequestBody,
): Promise<BatchProcessResult<ContentEmbeddingRecord>> => {
  return processAndInsertBatch<
    ContentEmbeddingBatchItemInput,
    ProcessedEmbeddingItem,
    ContentEmbeddingRecord
  >(
    supabase,
    embeddingItems,
    TARGET_EMBEDDING_TABLE,
    "*",
    validateAndProcessEmbeddingItem,
    "ContentEmbedding",
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createClient();

  try {
    const body = await request.json();

    const validationResult =
      ContentEmbeddingBatchRequestBodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `Item at path ${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return createApiResponse(request, {
        error: "Validation Error",
        details: errorMessages,
        status: 400,
      });
    }

    const validatedEmbeddingItems = validationResult.data;

    const result = await batchInsertEmbeddingsProcess(
      supabase,
      validatedEmbeddingItems,
    );

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
