import { NextResponse, NextRequest } from "next/server";
import type { PostgrestResponse } from "@supabase/supabase-js";

import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import {
  processAndInsertBatch,
  known_embedding_tables,
} from "~/utils/supabase/dbUtils";
import {
  ApiInputEmbeddingItem,
  ApiOutputEmbeddingRecord,
  embeddingInputProcessing,
  embeddingOutputProcessing,
} from "~/utils/supabase/validators";

const DEFAULT_MODEL = "openai_text_embedding_3_small_1536";

const batchInsertEmbeddingsProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  embeddingItems: ApiInputEmbeddingItem[],
): Promise<PostgrestResponse<ApiOutputEmbeddingRecord>> => {
  // groupBy is node21 only, we are using 20. Group by model, by hand.
  // Note: This means that later index values may be totally wrong.
  // Note2: The key is a ModelName, but I cannot use an enum as a key.
  const by_model: { [key: string]: ApiInputEmbeddingItem[] } = {};
  try {
    embeddingItems.reduce((acc, item, index) => {
      const model = item?.model || DEFAULT_MODEL;
      if (acc[model] === undefined) {
        acc[model] = [];
      }
      acc[model]!.push(item);
      return acc;
    }, by_model);
  } catch (error) {
    if (error instanceof Error) {
      return asPostgrestFailure(error.message, "exception");
    }
    throw error;
  }

  const globalResults: ApiOutputEmbeddingRecord[] = [];
  const partial_errors: string[] = [];
  let created = false,
    count = 0,
    has_400 = false;
  for (const model_name of Object.keys(by_model)) {
    const embeddingItemsSet = by_model[model_name];
    const table_data = known_embedding_tables[model_name];
    if (table_data === undefined) continue;
    const results = await processAndInsertBatch<
      // any ContentEmbedding table for type checking purposes only
      "ContentEmbedding_openai_text_embedding_3_small_1536",
      ApiInputEmbeddingItem,
      ApiOutputEmbeddingRecord
    >({
      supabase,
      items: embeddingItemsSet!,
      tableName: table_data.table_name,
      inputProcessor: embeddingInputProcessing,
      outputProcessor: embeddingOutputProcessing,
    });
    if (results.data) {
      count += results.data.length;
      globalResults.push(...results.data);
      created = created || results.status === 201;
    } else {
      partial_errors.push(results.error.message);
      if (results.status == 400) has_400 = true;
    }
  }
  if (count > 0) {
    if (partial_errors.length > 0) {
      return {
        data: globalResults,
        error: null,
        status: has_400 ? 400 : 500,
        count,
        statusText: partial_errors.join("; "),
      };
    } else
      return {
        data: globalResults,
        error: null,
        status: created ? 201 : 200,
        count,
        statusText: created ? "created" : "success",
      };
  } else {
    return asPostgrestFailure(
      partial_errors.join("; "),
      "multiple",
      has_400 ? 400 : 500,
    );
  }
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createClient();

  try {
    const body: ApiInputEmbeddingItem[] = await request.json();
    if (!Array.isArray(body)) {
      return createApiResponse(
        request,
        asPostgrestFailure(
          "Request body must be an array of embedding items.",
          "empty",
        ),
      );
    }

    const result = await batchInsertEmbeddingsProcess(supabase, body);

    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(
      request,
      e,
      `/api/supabase/content-embedding/batch`,
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
