import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";

const ContentEmbeddingDataInputSchema = z.object({
  target_id: z
    .number()
    .int()
    .positive({ message: "target_id must be a positive integer." }),
  model: z.string().min(1, { message: "Model name cannot be empty." }),
  vector: z
    .array(z.number())
    .nonempty({ message: "Vector array cannot be empty." }),
  obsolete: z.boolean().optional().default(false),
});

type ContentEmbeddingDataInput = z.infer<
  typeof ContentEmbeddingDataInputSchema
>;

interface ContentEmbeddingRecord {
  id: number;
  target_id: number;
  model: string;
  vector: string;
  obsolete: boolean;
}

const TARGET_EMBEDDING_TABLE =
  "ContentEmbedding_openai_text_embedding_3_small_1536";

const processAndCreateEmbedding = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ContentEmbeddingDataInput, // data is now Zod-validated
): Promise<GetOrCreateEntityResult<ContentEmbeddingRecord>> => {
  const { target_id, model, vector, obsolete } = data;

  const vectorString = JSON.stringify(vector);
  const supabase = await supabasePromise;

  const embeddingToInsert = {
    target_id,
    model,
    vector: vectorString,
    obsolete,
  };

  const result = await getOrCreateEntity<ContentEmbeddingRecord>(
    supabase,
    TARGET_EMBEDDING_TABLE,
    "*",
    { id: -1 },
    embeddingToInsert,
    "ContentEmbedding",
  );

  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    if (
      result.details
        .toLowerCase()
        .includes(
          `${TARGET_EMBEDDING_TABLE.toLowerCase()}_target_id_fkey`.toLowerCase(),
        ) ||
      result.details.toLowerCase().includes("target_id")
    ) {
      return {
        ...result,
        error: `Invalid target_id: No Content record found for ID ${target_id}.`,
      };
    }
  }

  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();

    const validationResult = ContentEmbeddingDataInputSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return createApiResponse(request, {
        error: "Validation Error",
        details: errorMessages,
        status: 400,
      });
    }

    const validatedData = validationResult.data;

    const result = await processAndCreateEmbedding(
      supabasePromise,
      validatedData,
    );

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(
      request,
      e,
      `/api/supabase/insert/${TARGET_EMBEDDING_TABLE}`,
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
