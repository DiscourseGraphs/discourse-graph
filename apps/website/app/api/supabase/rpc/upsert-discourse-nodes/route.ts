import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import cors from "~/utils/llm/cors";

interface UpsertDiscourseNodesRequest {
  p_platform_name?: string;
  p_platform_url?: string;
  p_space_name: string;
  p_space_url?: string;
  p_user_email: string;
  p_user_name: string;
  p_agent_type?: string;
  p_content_scale?: string;
  p_embedding_model?: string;
  p_document_source_id?: string;
  p_nodes: Array<{
    text: string;
    uid: string;
    vector: number[];
    metadata: Record<string, unknown>;
    created: string;
    last_modified: string;
  }>;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: UpsertDiscourseNodesRequest = await request.json();

    // Validate required fields
    if (!body.p_space_name) {
      response = NextResponse.json(
        { error: "Missing required field: p_space_name" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (!body.p_user_email) {
      response = NextResponse.json(
        { error: "Missing required field: p_user_email" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (!body.p_nodes || !Array.isArray(body.p_nodes)) {
      response = NextResponse.json(
        { error: "Missing required field: p_nodes (must be an array)" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }

    console.log(
      `Upserting ${body.p_nodes.length} discourse nodes for space: ${body.p_space_name}`,
    );

    // Call the Supabase function
    const { data, error } = await supabase.rpc("alpha_upsert_discourse_nodes", {
      p_space_name: body.p_space_name,
      p_user_email: body.p_user_email,
      p_nodes: body.p_nodes,
    });

    if (error) {
      console.error(
        "Error calling alpha_upsert_discourse_nodes function:",
        error,
      );
      response = NextResponse.json(
        {
          error: "Database error while upserting discourse nodes",
          details: error.message,
        },
        { status: 500 },
      );
    } else {
      console.log(`Successfully upserted ${data?.length || 0} discourse nodes`);
      response = NextResponse.json(data, { status: 200 });
    }
  } catch (e: any) {
    console.error(
      "API route error in /api/supabase/rpc/upsert-discourse-nodes:",
      e,
    );
    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      response = NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
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
