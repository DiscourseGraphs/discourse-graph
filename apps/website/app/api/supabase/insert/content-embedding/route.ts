import { createClient } from "~/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { target_id, vector, obsolete } = body;

    if (
      target_id === undefined ||
      vector === undefined ||
      obsolete === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!Array.isArray(vector) || !vector.every((v) => typeof v === "number")) {
      return NextResponse.json(
        { error: "Invalid vector format. Expected an array of numbers." },
        { status: 400 },
      );
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
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: "Data inserted successfully", data },
      { status: 201 },
    );
  } catch (e: any) {
    console.error("API route error:", e);
    return NextResponse.json(
      { error: e.message || "An unexpected error occurred" },
      { status: 500 },
    );
  }
}
