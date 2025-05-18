import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

// Based on LinkML for Embedding and the target table name
interface ContentEmbeddingBatchItemInput {
  target_id: number; // Foreign key to Content.id
  model: string;
  vector: number[] | string; // Accept string for pre-formatted, or number[]
  obsolete?: boolean;
}

type ContentEmbeddingBatchRequestBody = ContentEmbeddingBatchItemInput[];

interface ContentEmbeddingBatchResult {
  data?: any[]; // Array of successfully created embedding records
  error?: string;
  details?: string;
}

const TARGET_EMBEDDING_TABLE =
  "ContentEmbedding_openai_text_embedding_3_small_1536";

async function batchInsertEmbeddings(
  supabase: SupabaseClient<any, "public", any>,
  embeddingItems: ContentEmbeddingBatchRequestBody,
): Promise<ContentEmbeddingBatchResult> {
  if (!Array.isArray(embeddingItems) || embeddingItems.length === 0) {
    return {
      error: "Request body must be a non-empty array of embedding items.",
    };
  }

  const processedEmbeddingItems = embeddingItems.map((item, i) => {
    if (!item) {
      throw new Error(
        `Validation Error: Item at index ${i} is undefined or null.`,
      );
    }
    if (
      item.target_id === undefined ||
      item.target_id === null ||
      !item.model ||
      !item.vector
    ) {
      throw new Error(
        `Validation Error: Item at index ${i} is missing required fields (target_id, model, vector).`,
      );
    }
    if (!Array.isArray(item.vector) && typeof item.vector !== "string") {
      throw new Error(
        `Validation Error: Item.vector at index ${i} must be an array of numbers or a pre-formatted string.`,
      );
    }
    // Ensure vector is stringified if it's an array
    const vectorString = Array.isArray(item.vector)
      ? JSON.stringify(item.vector)
      : item.vector;

    return {
      target_id: item.target_id,
      model: item.model,
      vector: vectorString,
      obsolete: item.obsolete === undefined ? false : item.obsolete, // Default to false
    };
  });

  const { data: newEmbeddings, error: insertError } = await supabase
    .from(TARGET_EMBEDDING_TABLE)
    .insert(processedEmbeddingItems)
    .select();

  if (insertError) {
    console.error(
      `Error batch inserting embeddings into ${TARGET_EMBEDDING_TABLE}:`,
      insertError,
    );
    return {
      error: `Database error during batch insert of embeddings into ${TARGET_EMBEDDING_TABLE}.`,
      details: insertError.message,
    };
  }

  if (
    !newEmbeddings ||
    newEmbeddings.length !== processedEmbeddingItems.length
  ) {
    console.warn(
      "Batch insert Embeddings: Mismatch between input and output count or no data returned.",
      {
        inputCount: processedEmbeddingItems.length,
        outputCount: newEmbeddings?.length,
      },
    );
    return {
      error:
        "Batch insert of Embeddings might have partially failed or returned unexpected data.",
    };
  }

  console.log(
    `Successfully batch inserted ${newEmbeddings.length} embedding records into ${TARGET_EMBEDDING_TABLE}.`,
  );
  return { data: newEmbeddings };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: ContentEmbeddingBatchRequestBody = await request.json();
    const result = await batchInsertEmbeddings(supabase, body);

    if (result.error) {
      console.error(
        `API Error for batch Embedding creation: ${result.error}`,
        result.details || "",
      );
      const statusCode = result.error.startsWith("Validation Error:")
        ? 400
        : 500;
      response = NextResponse.json(
        { error: result.error, details: result.details },
        { status: statusCode },
      );
    } else {
      response = NextResponse.json(result.data, { status: 201 });
    }
  } catch (e: any) {
    console.error(
      `API route error in /api/supabase/insert/${TARGET_EMBEDDING_TABLE}/batch:`,
      e,
    );
    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      response = NextResponse.json(
        {
          error:
            "Invalid JSON in request body. Expected an array of embedding items.",
        },
        { status: 400 },
      );
    } else if (e.message?.startsWith("Validation Error:")) {
      response = NextResponse.json({ error: e.message }, { status: 400 });
    } else {
      response = NextResponse.json(
        { error: "An unexpected error occurred processing your request" },
        { status: 500 },
      );
    }
  }
  return cors(request, response) as NextResponse;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}
