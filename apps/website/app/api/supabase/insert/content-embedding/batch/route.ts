import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  processAndInsertBatch,
  BatchProcessResult,
} from "~/utils/supabase/dbUtils";
import {
  inputProcessing,
  outputProcessing,
  type ApiInputEmbeddingItem,
  type ApiOutputEmbeddingRecord,
} from "../route";

const batchInsertEmbeddingsProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  embeddingItems: ApiInputEmbeddingItem[],
): Promise<BatchProcessResult<ApiOutputEmbeddingRecord>> => {
  // groupBy is node21 only. Group by model.
  // Note: This means that later index values may be totally wrong.
  const by_model: { [key: string]: ApiInputEmbeddingItem[] } = {};
  for (let i = 0; i < embeddingItems.length; i++) {
    const inputItem = embeddingItems[i];
    if (inputItem !== undefined && inputItem.model !== undefined) {
      if (by_model[inputItem.model] === undefined) {
        by_model[inputItem.model] = [inputItem];
      } else {
        by_model[inputItem.model]!.push(inputItem);
      }
    } else {
      return {
        status: 400,
        error: `Element ${i} undefined or does not have a model`,
      };
    }
  }
  const globalResults: ApiOutputEmbeddingRecord[] = [];
  const partial_errors = [];
  let created = true; // TODO: Maybe transmit from below
  for (const table_name of Object.keys(by_model)) {
    const embeddingItemsSet = by_model[table_name];
    const results = await processAndInsertBatch<
      "ContentEmbedding_openai_text_embedding_3_small_1536",
      ApiInputEmbeddingItem,
      ApiOutputEmbeddingRecord
    >(
      supabase,
      embeddingItemsSet!,
      table_name,
      "*", // Select all fields, adjust if needed for ContentEmbeddingRecord
      "ContentEmbedding",
      inputProcessing!,
      outputProcessing,
    );
    if (results.error || results.data === undefined)
      return { ...results, data: undefined };
    globalResults.push(...results.data);
    if (results.partial_errors !== undefined)
      partial_errors.push(...results.partial_errors);
  }
  return {
    data: globalResults,
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
