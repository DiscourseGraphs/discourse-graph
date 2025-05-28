import { NextResponse, NextRequest } from "next/server";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import {
  getOrCreateEntity,
  known_embedding_tables,
} from "~/utils/supabase/dbUtils";
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";
import {
  ApiInputEmbeddingItem,
  ApiOutputEmbeddingRecord,
  embeddingInputProcessing,
  embeddingOutputProcessing,
} from "~/utils/supabase/validators";

// Use the first known ContentEmbedding table for type checking, as they have the same structure
export type ContentEmbeddingDataInput =
  TablesInsert<"ContentEmbedding_openai_text_embedding_3_small_1536">;
export type ContentEmbeddingRecord =
  Tables<"ContentEmbedding_openai_text_embedding_3_small_1536">;

const DEFAULT_MODEL = "openai_text_embedding_3_small_1536";

const processAndCreateEmbedding = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ApiInputEmbeddingItem,
): Promise<PostgrestSingleResponse<ApiOutputEmbeddingRecord>> => {
  const { valid, error, processedItem } = embeddingInputProcessing(data);
  if (
    !valid ||
    processedItem === undefined ||
    processedItem.model === undefined
  )
    return asPostgrestFailure(error || "unknown error", "valid");
  const supabase = await supabasePromise;
  const tableData =
    known_embedding_tables[processedItem.model || DEFAULT_MODEL];

  if (!tableData) return asPostgrestFailure("Unknown model", "unknown");

  const { table_name } = tableData;
  // Using getOrCreateEntity, forcing create path by providing non-matching criteria
  // This standardizes return type and error handling (e.g., FK violations from dbUtils)
  const result =
    await getOrCreateEntity<"ContentEmbedding_openai_text_embedding_3_small_1536">(
      {
        supabase,
        tableName: table_name,
        insertData: processedItem,
      },
    );

  if (result.error) {
    return result;
  }

  const processedResult = embeddingOutputProcessing(result.data);
  if (!processedResult.processedItem) {
    return asPostgrestFailure(
      processedResult.error || "unknown error",
      "postinvalid",
      500,
    );
  }
  if (processedResult.error) {
    // err on the side of returning the data
    return {
      ...result,
      status: 500,
      data: processedResult.processedItem,
      statusText: processedResult.error,
    };
  }
  return {
    ...result,
    data: processedResult.processedItem,
  };
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: ApiInputEmbeddingItem = await request.json();
    const result = await processAndCreateEmbedding(supabasePromise, body);
    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, `/api/supabase/content-embedding`);
  }
};

export const OPTIONS = defaultOptionsHandler;
