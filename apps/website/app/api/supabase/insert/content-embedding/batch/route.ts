import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  processAndInsertBatch,
  BatchProcessResult,
  known_embedding_tables,
} from "~/utils/supabase/dbUtils";

import {
  inputProcessing,
  outputProcessing,
  type ApiInputEmbeddingItem,
  type ApiOutputEmbeddingRecord,
} from "~/api/supabase/insert/content-embedding/route";

const batchInsertEmbeddingsProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  embeddingItems: ApiInputEmbeddingItem[],
): Promise<BatchProcessResult<ApiOutputEmbeddingRecord>> => {
  // groupBy is node21 only, we are using 20. Group by model, by hand.
  // Note: This means that later index values may be totally wrong.
  // Note2: The key is a ModelName, but I cannot use an enum as a key.
  const by_model: { [key: string]: ApiInputEmbeddingItem[] } = {};
  try {
    embeddingItems.reduce((acc, item, index) => {
      if (!item?.model) {
        throw new Error(`Element ${index} undefined or does not have a model`);
      }
      if (acc[item.model] === undefined) {
        acc[item.model] = [];
      }
      acc[item.model]!.push(item);
      return acc;
    }, by_model);
  } catch (error) {
    if (error instanceof Error) {
      return {
        status: 400,
        error: error.message,
      };
    }
    throw error;
  }

  const globalResults: ApiOutputEmbeddingRecord[] = [];
  const partial_errors = [];
  let created = false;
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
      inputProcessor: inputProcessing,
      outputProcessor: outputProcessing,
    });
    if (results.error || results.data === undefined)
      return { ...results, data: undefined };
    globalResults.push(...results.data);
    if (results.partial_errors !== undefined)
      partial_errors.push(...results.partial_errors);
    created = created || results.status === 201;
  }
  return {
    data: globalResults,
    error: null,
    partial_errors,
    status: created ? 201 : 200,
  };
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createClient();

  try {
    const body: ApiInputEmbeddingItem[] = await request.json();
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
      `/api/supabase/insert/content-embedding/batch`,
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
