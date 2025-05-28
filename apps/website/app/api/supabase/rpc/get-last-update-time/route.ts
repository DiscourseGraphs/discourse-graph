import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface RequestBody {
  spaceName: string;
}

interface RpcResponseItem {
  last_update_time: string | null;
}

async function callGetLastUpdateTimeRpc(
  supabase: SupabaseClient<any, "public", any>,
  { spaceName }: RequestBody,
): Promise<{ data: RpcResponseItem | null; error: any }> {
  console.log("[API Route] callGetLastUpdateTimeRpc: Started", {
    spaceName,
  });

  if (!spaceName || typeof spaceName !== "string" || spaceName.trim() === "") {
    console.log(
      "[API Route] callGetLastUpdateTimeRpc: Invalid or empty spaceName.",
    );
    return {
      data: null,
      error: { message: "Invalid or empty spaceName" },
    };
  }

  console.log(
    "[API Route] callGetLastUpdateTimeRpc: Calling supabase.rpc('alpha_get_last_update_time').",
  );
  const { data, error } = await supabase.rpc("alpha_get_last_update_time", {
    p_space_name: spaceName.trim(),
  });

  if (error) {
    console.error(
      "[API Route] callGetLastUpdateTimeRpc: Error from supabase.rpc:",
      JSON.stringify(error, null, 2),
    );
    return { data: null, error };
  }

  console.log(
    "[API Route] callGetLastUpdateTimeRpc: Successfully received data from RPC:",
    data,
  );
  return { data: data as RpcResponseItem, error: null };
}

export async function POST(request: NextRequest) {
  console.log(
    "[API Route] POST /api/supabase/rpc/get-last-update-time: Request received",
  );
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: RequestBody = await request.json();
    console.log("[API Route] POST: Parsed request body:", body);

    console.log("[API Route] POST: Calling callGetLastUpdateTimeRpc.");
    const { data, error } = await callGetLastUpdateTimeRpc(supabase, body);
    console.log("[API Route] POST: Received from callGetLastUpdateTimeRpc:", {
      data,
      error,
    });

    if (error) {
      console.error(
        "[API Route] POST: Error after callGetLastUpdateTimeRpc:",
        error.message || error,
      );
      const statusCode = error.message?.includes("Invalid") ? 400 : 500;
      response = NextResponse.json(
        {
          error: error.message || "Failed to get last update time via RPC.",
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
