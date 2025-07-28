import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";
import type { LocalContentDataInput } from "@repo/database/inputTypes";

// Define a JSON compatible type for Supabase RPC parameters
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

interface UpsertContentRequest {
  v_space_id: number;
  v_creator_id: number;
  data: LocalContentDataInput[];
  content_as_document?: boolean;
}

interface RpcResponse {
  data: number[] | null;
  error: any;
}

async function callUpsertContentRpc(
  supabase: SupabaseClient<any, "public", any>,
  { v_space_id, v_creator_id, data, content_as_document }: UpsertContentRequest,
): Promise<RpcResponse> {
  console.log("[API Route] callUpsertContentRpc: Started", {
    v_space_id,
    v_creator_id,
    contentsCount: data?.length,
    content_as_document,
  });

  // Validation
  if (
    v_space_id === undefined ||
    v_space_id === null ||
    typeof v_space_id !== "number"
  ) {
    return { data: null, error: { message: "Invalid or missing v_space_id" } };
  }
  if (
    v_creator_id === undefined ||
    v_creator_id === null ||
    typeof v_creator_id !== "number"
  ) {
    return {
      data: null,
      error: { message: "Invalid or missing v_creator_id" },
    };
  }
  if (!data || !Array.isArray(data)) {
    return {
      data: null,
      error: { message: "Invalid data – must be an array of content" },
    };
  }

  console.log(
    "[API Route] callUpsertContentRpc: Calling supabase.rpc('upsert_content').",
  );
  const { data: rpcData, error } = await supabase.rpc("upsert_content", {
    v_space_id,
    v_creator_id,
    data: data as unknown as Json,
    content_as_document: content_as_document ?? false,
  });

  if (error) {
    console.error(
      "[API Route] callUpsertContentRpc: Error from supabase.rpc:",
      JSON.stringify(error, null, 2),
    );
    return { data: null, error };
  }

  console.log(
    "[API Route] callUpsertContentRpc: Successfully received data from RPC.",
    rpcData,
  );
  return { data: rpcData as number[], error: null };
}

export async function POST(request: NextRequest) {
  console.log(
    "[API Route] POST /api/supabase/rpc/upsert-content: Request received",
  );
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: UpsertContentRequest = await request.json();
    console.log("[API Route] POST: Parsed request body", {
      v_space_id: body?.v_space_id,
      v_creator_id: body?.v_creator_id,
      contentsCount: body?.data?.length,
      content_as_document: body?.content_as_document,
    });

    const { data, error } = await callUpsertContentRpc(supabase, body);

    if (error) {
      console.error(
        "[API Route] POST: Error after callUpsertContentRpc",
        error,
      );
      const statusCode = error.message?.includes("Invalid") ? 400 : 500;
      response = NextResponse.json(
        {
          error: error.message || "Failed to upsert content via RPC.",
          details: error.details || JSON.stringify(error, null, 2),
        },
        { status: statusCode },
      );
    } else {
      response = NextResponse.json({ ids: data }, { status: 200 });
    }
  } catch (e: any) {
    console.error("[API Route] POST: Exception in POST handler", e);

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

  return cors(request, response) as NextResponse;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}
