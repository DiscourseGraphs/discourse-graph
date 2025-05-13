import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface RequestBody {
  queryEmbedding: number[];
  subsetRoamUids: string[];
}

// Define the expected structure of an item returned by the RPC
interface RpcResponseItem {
  roam_uid: string;
  text_content: string;
  similarity: number;
  // Add any other fields returned by your RPC
}

async function callMatchEmbeddingsRpc(
  supabase: SupabaseClient<any, "public", any>,
  { queryEmbedding, subsetRoamUids }: RequestBody,
): Promise<{ data: RpcResponseItem[] | null; error: any }> {
  console.log("[API Route] callMatchEmbeddingsRpc: Started", {
    queryEmbeddingLength: queryEmbedding?.length,
    subsetRoamUidsCount: subsetRoamUids?.length,
  });

  if (
    !queryEmbedding ||
    !Array.isArray(queryEmbedding) ||
    queryEmbedding.length === 0
  ) {
    console.log(
      "[API Route] callMatchEmbeddingsRpc: Invalid or empty queryEmbedding.",
    );
    return {
      data: null,
      error: { message: "Invalid or empty queryEmbedding" },
    };
  }
  if (!subsetRoamUids || !Array.isArray(subsetRoamUids)) {
    console.log("[API Route] callMatchEmbeddingsRpc: Invalid subsetRoamUids.");
    return { data: null, error: { message: "Invalid subsetRoamUids" } };
  }

  // If subsetRoamUids is empty, the RPC might not find anything or error,
  // depending on its implementation. It might be more efficient to return early.
  if (subsetRoamUids.length === 0) {
    console.log(
      "[API Route] callMatchEmbeddingsRpc: subsetRoamUids is empty, returning empty array without calling RPC.",
    );
    return { data: [], error: null }; // Return empty array, no need to call RPC
  }

  console.log(
    "[API Route] callMatchEmbeddingsRpc: Calling supabase.rpc('match_embeddings_for_subset_nodes').",
  );
  const { data, error } = await supabase.rpc(
    "match_embeddings_for_subset_nodes",
    {
      p_query_embedding: queryEmbedding,
      p_subset_roam_uids: subsetRoamUids,
    },
  );

  if (error) {
    console.error(
      "[API Route] callMatchEmbeddingsRpc: Error from supabase.rpc:",
      JSON.stringify(error, null, 2), // Stringify for better console output of complex error objects
    );
    return { data: null, error };
  }

  console.log(
    "[API Route] callMatchEmbeddingsRpc: Successfully received data from RPC. Data length:",
    data?.length,
  );
  return { data: data as RpcResponseItem[], error: null };
}

export async function POST(request: NextRequest) {
  console.log(
    "[API Route] POST /api/supabase/rpc/match-embeddings-for-subset-nodes: Request received",
  );
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
        error.message || error,
      );
      const statusCode = error.message?.includes("Invalid") ? 400 : 500;
      response = NextResponse.json(
        {
          error: error.message || "Failed to match embeddings via RPC.",
          details: error.details || JSON.stringify(error, null, 2),
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
  return cors(request, response);
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response);
}
