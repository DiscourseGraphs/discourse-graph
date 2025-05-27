import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
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

const processAndCreateEmbedding = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ApiInputEmbeddingItem,
): Promise<GetOrCreateEntityResult<ApiOutputEmbeddingRecord>> => {
  const { valid, error, processedItem } = embeddingInputProcessing(data);
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
  const tableData = known_embedding_tables[processedItem.model];

  if (!tableData) {
    return {
      entity: null,
      error: "unknown model",
      created: false,
      status: 400,
    };
  }

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

  if (result.error || !result.entity) {
    return {
      ...result,
      entity: null,
    };
  }

  const processedResult = embeddingOutputProcessing(result.entity);
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
    const result = await processAndCreateEmbedding(supabasePromise, body);

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, `/api/supabase/content-embedding`);
  }
};

export const OPTIONS = defaultOptionsHandler;
