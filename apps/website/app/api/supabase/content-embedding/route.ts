import { NextResponse, NextRequest } from "next/server";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  getOrCreateEntity,
  KNOWN_EMBEDDING_TABLES,
} from "~/utils/supabase/dbUtils";
import {
  ApiInputEmbeddingItem,
  ApiOutputEmbeddingRecord,
  embeddingInputProcessing,
  embeddingOutputProcessing,
} from "~/utils/supabase/validators";

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
    KNOWN_EMBEDDING_TABLES[processedItem.model || DEFAULT_MODEL];

  if (!tableData) return asPostgrestFailure("Unknown model", "unknown");

  const { tableName } = tableData;
  // Using getOrCreateEntity, forcing create path by providing non-matching criteria
  // This standardizes return type and error handling (e.g., FK violations from dbUtils)
  const result =
    await getOrCreateEntity<"ContentEmbedding_openai_text_embedding_3_small_1536">(
      {
        supabase,
        tableName,
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
