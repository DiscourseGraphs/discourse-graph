import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface RequestBody {
  p_space_name: string;
  p_source_local_ids: string[];
}

async function callDeleteBySourceLocalIdsRpc(
  supabase: SupabaseClient<any, "public", any>,
  { p_space_name, p_source_local_ids }: RequestBody,
): Promise<{ data: string | null; error: any }> {
  console.log("[API Route] callDeleteBySourceLocalIdsRpc: Started", {
    p_space_name,
    p_source_local_ids_count: p_source_local_ids?.length,
  });

  if (
    !p_space_name ||
    typeof p_space_name !== "string" ||
    p_space_name.trim() === ""
  ) {
    console.log(
      "[API Route] callDeleteBySourceLocalIdsRpc: Invalid or empty p_space_id.",
    );
    return {
      data: null,
      error: { message: "Invalid or empty p_space_name" },
    };
  }

  if (!p_source_local_ids || !Array.isArray(p_source_local_ids)) {
    console.log(
      "[API Route] callDeleteBySourceLocalIdsRpc: Invalid p_source_local_ids - must be an array.",
    );
    return {
      data: null,
      error: { message: "Invalid p_source_local_ids - must be an array" },
    };
  }

  console.log(
    "[API Route] callDeleteBySourceLocalIdsRpc: Calling supabase.rpc('alpha_delete_by_source_local_ids').",
  );
  const { data, error } = await supabase.rpc(
    "alpha_delete_by_source_local_ids",
    {
      p_space_name: p_space_name.trim(),
      p_source_local_ids: p_source_local_ids,
    },
  );

  if (error) {
    console.error(
      "[API Route] callDeleteBySourceLocalIdsRpc: Error from supabase.rpc:",
      JSON.stringify(error, null, 2),
    );
    return { data: null, error };
  }

  console.log(
    "[API Route] callDeleteBySourceLocalIdsRpc: Successfully received data from RPC:",
    data,
  );
  return { data: data as string, error: null };
}

export async function POST(request: NextRequest) {
  console.log(
    "[API Route] POST /api/supabase/rpc/alpha_delete_by_source_local_ids: Request received",
  );
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: RequestBody = await request.json();
    console.log("[API Route] POST: Parsed request body:", {
      p_space_name: body.p_space_name,
      p_source_local_ids_count: body.p_source_local_ids?.length,
    });

    console.log("[API Route] POST: Calling callDeleteBySourceLocalIdsRpc.");
    const { data, error } = await callDeleteBySourceLocalIdsRpc(supabase, body);
    console.log(
      "[API Route] POST: Received from callDeleteBySourceLocalIdsRpc:",
      {
        data,
        error,
      },
    );

    if (error) {
      console.error(
        "[API Route] POST: Error after callDeleteBySourceLocalIdsRpc:",
        error.message || error,
      );
      const statusCode = error.message?.includes("Invalid") ? 400 : 500;
      response = NextResponse.json(
        {
          error:
            error.message || "Failed to delete by source local IDs via RPC.",
          details: error.details || JSON.stringify(error, null, 2),
        },
        { status: statusCode },
      );
    } else {
      console.log(
        "[API Route] POST: Successfully processed request. Sending data back:",
        data,
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
