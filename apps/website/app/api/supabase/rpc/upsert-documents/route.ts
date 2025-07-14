import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";
import type { LocalDocumentDataInput } from "../../../../../../../packages/database/inputTypes.ts";

// Define a JSON compatible type for Supabase RPC parameters
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };

interface UpsertDocumentsRequest {
  v_space_id: number;
  data: LocalDocumentDataInput[];
}

interface RpcResponse {
  data: number[] | null;
  error: any;
}

async function callUpsertDocumentsRpc(
  supabase: SupabaseClient<any, "public", any>,
  { v_space_id, data }: UpsertDocumentsRequest,
): Promise<RpcResponse> {
  console.log("[API Route] callUpsertDocumentsRpc: Started", {
    v_space_id,
    documentsCount: data?.length,
  });

  // Basic validation
  if (
    v_space_id === undefined ||
    v_space_id === null ||
    typeof v_space_id !== "number"
  ) {
    console.log(
      "[API Route] callUpsertDocumentsRpc: Invalid or missing v_space_id.",
    );
    return { data: null, error: { message: "Invalid or missing v_space_id" } };
  }

  if (!data || !Array.isArray(data)) {
    console.log(
      "[API Route] callUpsertDocumentsRpc: Invalid data – must be an array.",
    );
    return {
      data: null,
      error: { message: "Invalid data – must be an array of documents" },
    };
  }

  console.log(
    "[API Route] callUpsertDocumentsRpc: Calling supabase.rpc('upsert_documents').",
  );
  const { data: rpcData, error } = await supabase.rpc("upsert_documents", {
    v_space_id,
    data: data as unknown as Json,
  });

  if (error) {
    console.error(
      "[API Route] callUpsertDocumentsRpc: Error from supabase.rpc:",
      JSON.stringify(error, null, 2),
    );
    return { data: null, error };
  }

  console.log(
    "[API Route] callUpsertDocumentsRpc: Successfully received data from RPC. IDs returned:",
    rpcData,
  );
  return { data: rpcData as number[], error: null };
}

export async function POST(request: NextRequest) {
  console.log(
    "[API Route] POST /api/supabase/rpc/upsert-documents: Request received",
  );
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: UpsertDocumentsRequest = await request.json();
    console.log("[API Route] POST: Parsed request body:", {
      v_space_id: body?.v_space_id,
      documentsCount: body?.data?.length,
    });

    const { data, error } = await callUpsertDocumentsRpc(supabase, body);

    if (error) {
      console.error(
        "[API Route] POST: Error after callUpsertDocumentsRpc:",
        error,
      );
      const statusCode = error.message?.includes("Invalid") ? 400 : 500;
      response = NextResponse.json(
        {
          error: error.message || "Failed to upsert documents via RPC.",
          details: error.details || JSON.stringify(error, null, 2),
        },
        { status: statusCode },
      );
    } else {
      console.log(
        "[API Route] POST: Successfully processed request. Number of documents upserted:",
        data?.length,
      );
      response = NextResponse.json({ ids: data }, { status: 200 });
    }
  } catch (e: any) {
    console.error("[API Route] POST: Exception in POST handler:", e);

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
