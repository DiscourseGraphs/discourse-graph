import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

type ContentEmbeddingDataInput =
  TablesInsert<"ContentEmbedding_openai_text_embedding_3_small_1536">;
type ContentEmbeddingRecord =
  Tables<"ContentEmbedding_openai_text_embedding_3_small_1536">;

const TARGET_EMBEDDING_TABLE =
  "ContentEmbedding_openai_text_embedding_3_small_1536";

// Renamed and refactored
const processAndCreateEmbedding = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ContentEmbeddingDataInput,
): Promise<GetOrCreateEntityResult<ContentEmbeddingRecord>> => {
  const { target_id, model, vector, obsolete = false } = data;

  // --- Start of validation ---
  if (
    target_id === undefined ||
    target_id === null ||
    typeof target_id !== "number"
  ) {
    return {
      entity: null,
      error: "Missing or invalid target_id.",
      created: false,
      status: 400,
    };
  }
  if (!model || typeof model !== "string") {
    return {
      entity: null,
      error: "Missing or invalid model name.",
      created: false,
      status: 400,
    };
  }
  if (
    !vector ||
    !Array.isArray(vector) ||
    !vector.every((v) => typeof v === "number")
  ) {
    return {
      entity: null,
      error: "Missing or invalid vector. Must be an array of numbers.",
      created: false,
      status: 400,
    };
  }
  if (data.obsolete !== undefined && typeof data.obsolete !== "boolean") {
    // Check original data for obsolete presence
    return {
      entity: null,
      error: "Invalid type for obsolete. Must be a boolean.",
      created: false,
      status: 400,
    };
  }
  // --- End of validation ---

  const vectorString = JSON.stringify(vector);
  const supabase = await supabasePromise;

  const embeddingToInsert = {
    target_id,
    model,
    vector: vectorString,
    obsolete,
  };

  // Using getOrCreateEntity, forcing create path by providing non-matching criteria
  // This standardizes return type and error handling (e.g., FK violations from dbUtils)
  const result =
    await getOrCreateEntity<"ContentEmbedding_openai_text_embedding_3_small_1536">(
      supabase,
      TARGET_EMBEDDING_TABLE,
      "*", // Select all fields for the record
      { id: -1 }, // Non-matching criteria to force "create" path
      embeddingToInsert,
      "ContentEmbedding",
    );

  // getOrCreateEntity handles general 23503, but we can make the message more specific if needed
  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    if (
      result.details.toLowerCase().includes(
        // Check for target_id FK, adapt if FK name is different
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
    const body: ContentEmbeddingDataInput = await request.json();

    // Minimal validation here, more detailed in processAndCreateEmbedding
    if (!body || typeof body !== "object") {
      return createApiResponse(request, {
        error: "Invalid request body: expected a JSON object.",
        status: 400,
      });
    }

    const result = await processAndCreateEmbedding(supabasePromise, body);

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created, // Will be true if successful create
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
