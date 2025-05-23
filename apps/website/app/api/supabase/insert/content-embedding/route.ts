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
  known_embedding_tables,
  ItemProcessor,
  ItemValidator,
} from "~/utils/supabase/dbUtils";
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

// Use the first known ContentEmbedding table for type checking, as they have the same structure
export type ContentEmbeddingDataInput =
  TablesInsert<"ContentEmbedding_openai_text_embedding_3_small_1536">;
export type ContentEmbeddingRecord =
  Tables<"ContentEmbedding_openai_text_embedding_3_small_1536">;

export type ApiInputEmbeddingItem = Omit<
  ContentEmbeddingDataInput,
  "vector"
> & {
  vector: number[]; // Vector is passed in as a number[]
};

export type ApiOutputEmbeddingRecord = Omit<
  ContentEmbeddingRecord,
  "vector"
> & {
  vector: number[]; // Vector is passed in as a number[]
};

export const inputValidation: ItemValidator<ApiInputEmbeddingItem> = (data) => {
  const { target_id, model, vector } = data;

  // --- Start of validation ---
  if (
    target_id === undefined ||
    target_id === null ||
    typeof target_id !== "number"
  ) {
    return "Missing or invalid target_id.";
  }
  if (
    !model ||
    typeof model !== "string" ||
    known_embedding_tables[model] == undefined
  ) {
    return "Missing or invalid model name.";
  }
  const { table_size } = known_embedding_tables[model];

  if (
    !vector ||
    !Array.isArray(vector) ||
    !vector.every((v) => typeof v === "number")
  ) {
    return "Missing or invalid vector. Must be an array of numbers.";
  }
  if (vector.length != table_size) {
    return `Invalid vector length. Expected ${table_size}, got ${vector.length}.`;
  }
  if (data.obsolete !== undefined && typeof data.obsolete !== "boolean") {
    // Check original data for obsolete presence
    return "Invalid type for obsolete. Must be a boolean.";
  }
  return null;
};

export const inputProcessing: ItemProcessor<
  ApiInputEmbeddingItem,
  ContentEmbeddingDataInput
> = (data) => {
  const error = inputValidation(data);
  if (error) {
    return { valid: false, error };
  }
  return {
    valid: true,
    data: { ...data, vector: JSON.stringify(data.vector) },
  };
};

export const outputValidation: ItemValidator<ApiOutputEmbeddingRecord> = (
  data,
) => {
  const { model, vector } = data;
  if (
    !model ||
    typeof model !== "string" ||
    known_embedding_tables[model] == undefined
  ) {
    return "Missing or invalid model name.";
  }

  const { table_size } = known_embedding_tables[model];

  if (vector.length != table_size) {
    return `Invalid vector length. Expected ${table_size}, got ${vector.length}.`;
  }
  return null;
};

export const outputProcessing: ItemProcessor<
  ContentEmbeddingRecord,
  ApiOutputEmbeddingRecord
> = (data) => {
  try {
    const processedData = { ...data, vector: JSON.parse(data.vector) };
    const error = outputValidation(processedData);
    if (error) {
      return { valid: false, error };
    }
    return {
      valid: true,
      data: processedData,
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { valid: false, error: error.message };
    }
    throw error;
  }
};

// Renamed and refactored
const processAndCreateEmbedding = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ApiInputEmbeddingItem,
): Promise<GetOrCreateEntityResult<ApiOutputEmbeddingRecord>> => {
  const { valid, error, processedItem } = inputProcessing(data);
  if (
    !valid ||
    processedItem === undefined ||
    processedItem.model === undefined
  ) {
    return {
      entity: null,
      error: error || "unknown error",
      created: false,
      status: 400,
    };
  }
  const supabase = await supabasePromise;
  const table_data = known_embedding_tables[processedItem.model];

  if (!table_data) {
    return {
      entity: null,
      error: "unknown model",
      created: false,
      status: 400,
    };
  }

  const { table_name } = table_data;
  // Using getOrCreateEntity, forcing create path by providing non-matching criteria
  // This standardizes return type and error handling (e.g., FK violations from dbUtils)
  const result =
    await getOrCreateEntity<"ContentEmbedding_openai_text_embedding_3_small_1536">(
      supabase,
      table_name,
      "*", // Select all fields for the record
      { id: -1 }, // Non-matching criteria to force "create" path
      processedItem,
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
        `${table_name.toLowerCase()}_target_id_fkey`,
      ) ||
      result.details.toLowerCase().includes("target_id")
    ) {
      return {
        ...result,
        entity: null,
        error: `Invalid target_id: No Content record found for ID ${processedItem.target_id}.`,
      };
    }
  }

  if (result.error || !result.entity) {
    return {
      ...result,
      entity: null,
    };
  }

  const processedResult = outputProcessing(result.entity);
  if (!processedResult.valid || !processedResult.processedItem)
    return {
      ...result,
      error: processedResult.error || "unknown error",
      entity: null,
      status: 500,
    };
  return {
    ...result,
    entity: processedResult.processedItem,
  };
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: ApiInputEmbeddingItem = await request.json();

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
      `/api/supabase/insert/content-embedding`,
      // TODO replace with a generic name
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
