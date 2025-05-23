import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";
import { Database } from "~/utils/supabase/types.gen";
import { get_known_embedding } from "~/utils/supabase/dbUtils";
import { generic_embedding } from "~/api/embeddings/route";

type RequestBody = {
  currentDocumentId?: number;
  queryEmbedding?: number[];
  queryText?: string;
  subsetPlatformIds?: string[];
  provider?: string;
  model?: string;
  dimensions?: number;
  limit?: number;
  threshold?: number;
};

type RpcResponseItem =
  Database["public"]["Functions"]["match_content_embeddings"]["Returns"];

async function callMatchEmbeddingsRpc(
  supabase: SupabaseClient<Database, "public", Database["public"]>,
  query: RequestBody,
): Promise<{ data?: RpcResponseItem; error?: string }> {
  const {
    currentDocumentId,
    queryEmbedding,
    queryText,
    subsetPlatformIds,
    provider = "openai",
    model = "text-embedding-3-small",
    dimensions = 1536,
    limit = 20,
    threshold = 0.8,
  } = query;
  let embedding: number[];
  const table_data = get_known_embedding(model!, dimensions!, provider!);
  if (table_data === undefined) {
    return {
      error: "Invalid model information",
    };
  }
  if (
    !queryEmbedding ||
    !Array.isArray(queryEmbedding) ||
    queryEmbedding.length === 0
  ) {
    if (!queryText) {
      return {
        error: "Provide either query text or embedding",
      };
    }
    const newEmbedding = await generic_embedding(
      queryText,
      model,
      provider,
      dimensions,
    );
    if (
      newEmbedding !== undefined &&
      newEmbedding.length &&
      !Array.isArray(newEmbedding[0])
    ) {
      embedding = newEmbedding as number[];
    } else {
      return {
        error: "Could not get the embedding for this text",
      };
    }
  } else {
    if (queryText) {
      return {
        error: "Do not provide both query text and embedding",
      };
    }
    if (queryEmbedding.length !== dimensions) {
      return {
        error: "Wrong dimensionality",
      };
    }
    embedding = queryEmbedding;
  }
  if (subsetPlatformIds !== undefined) {
    if (currentDocumentId !== undefined) {
      return {
        error: "Do not define both currentDocumentId and subsetPlatformIds",
      };
    }
    if (!Array.isArray(subsetPlatformIds)) {
      console.log(
        "[API Route] callMatchEmbeddingsRpc: Invalid subsetPlatformIds.",
      );
      return { error: "Invalid subsetPlatformIds" };
    }

    // If subsetPlatformIds is empty, the RPC might not find anything or error,
    // depending on its implementation. It might be more efficient to return early.
    if (subsetPlatformIds.length === 0) {
      console.log(
        "[API Route] callMatchEmbeddingsRpc: subsetPlatformIds is empty, returning empty array without calling RPC.",
      );
      return { data: [] }; // Return empty array, no need to call RPC
    }

    const response = await supabase.rpc("match_embeddings_for_subset_nodes", {
      p_query_embedding: JSON.stringify(embedding),
      p_subset_roam_uids: subsetPlatformIds,
    });
    return { data: response.data || undefined, error: response.error?.message };
  } else {
    const response = await supabase.rpc("match_content_embeddings", {
      current_document_id: currentDocumentId,
      match_count: limit,
      match_threshold: threshold,
      query_embedding: JSON.stringify(embedding),
    });
    return { data: response.data || undefined, error: response.error?.message };
  }
}

export async function POST(request: NextRequest) {
  console.log("[API Route] POST /api/supabase/rpc/search: Request received");
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: RequestBody = await request.json();
    console.log("[API Route] POST: Parsed request body:", body);

    console.log("[API Route] POST: Calling callMatchEmbeddingsRpc.");
    const { data, error } = await callMatchEmbeddingsRpc(supabase, body);
    console.log("[API Route] POST: Received from callMatchEmbeddingsRpc:", {
      dataLength: data?.length,
      error,
    });

    if (error) {
      console.error(
        "[API Route] POST: Error after callMatchEmbeddingsRpc:",
        error,
      );
      const statusCode = error?.includes("Invalid") ? 400 : 500;
      response = NextResponse.json(
        {
          error: error || "Failed to match embeddings via RPC.",
        },
        { status: statusCode },
      );
    } else {
      console.log(
        "[API Route] POST: Successfully processed request. Sending data back. Data length:",
        data?.length,
      );
      response = NextResponse.json(data, { status: 200 });
    }
  } catch (e: any) {
    console.error(
      "[API Route] POST: Exception in POST handler:",
      e.message,
      e.stack,
    );
    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      response = NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    } else {
      response = NextResponse.json(
        { error: "An unexpected error occurred processing your request." },
        { status: 500 },
      );
    }
  }
  console.log(
    "[API Route] POST: Sending final response with status:",
    response.status,
  );
  return cors(request, response) as NextResponse;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}
