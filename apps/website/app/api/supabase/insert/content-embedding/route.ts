import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import cors from "~/utils/llm/cors";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body = await request.json();
    const { target_id, vector, obsolete } = body;

    if (
      target_id === undefined ||
      vector === undefined ||
      obsolete === undefined
    ) {
      response = NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }

    if (!Array.isArray(vector) || !vector.every((v) => typeof v === "number")) {
      response = NextResponse.json(
        { error: "Invalid vector format. Expected an array of numbers." },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    const vectorString = JSON.stringify(vector);

    const { data, error } = await supabase
      .from("ContentEmbedding_openai_text_embedding_3_small_1536")
      .insert([
        {
          target_id: target_id as number,
          model: "openai_text_embedding_3_small_1536",
          vector: vectorString,
          obsolete: obsolete as boolean,
        },
      ])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      response = NextResponse.json({ error: error.message }, { status: 500 });
      return cors(request, response) as NextResponse;
    }

    response = NextResponse.json(
      { message: "Data inserted successfully", data },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("API route error:", e);
    response = NextResponse.json(
      { error: e.message || "An unexpected error occurred" },
      { status: 500 },
    );
  }
  return cors(request, response) as NextResponse;
}

export async function OPTIONS(req: NextRequest): Promise<NextResponse> {
  return cors(req, new NextResponse(null, { status: 204 })) as NextResponse;
}
