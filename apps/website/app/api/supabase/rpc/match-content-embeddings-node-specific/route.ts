import { createClient } from "~/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import cors from "~/utils/llm/cors";

interface RequestBody {
  p_query_embedding: number[];
  p_match_threshold: number;
  p_match_count: number;
  p_subset_roam_uids: string[];
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: RequestBody = await request.json();
    const {
      p_query_embedding,
      p_match_threshold,
      p_match_count,
      p_subset_roam_uids,
    } = body;

    if (
      !p_query_embedding ||
      !p_match_threshold ||
      !p_match_count ||
      !p_subset_roam_uids
    ) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase.rpc(
      "match_content_embeddings_node_specific" as any,
      {
        p_query_embedding,
        p_match_threshold,
        p_match_count,
        p_subset_roam_uids,
      },
    );

    if (error) {
      console.error("Error calling RPC:", error);
      response = NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      response = NextResponse.json(data, { status: 200 });
    }
  } catch (e: any) {
    console.error("Unexpected error:", e);
    response = NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }

  return cors(request, response) as NextResponse;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}
