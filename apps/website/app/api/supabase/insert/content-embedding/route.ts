import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body = await request.json();
    const { target_id, model, vector, obsolete } = body;

    // Basic validation (you might want to add more robust validation)
    if (
      target_id === undefined ||
      model === undefined ||
      vector === undefined ||
      obsolete === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Supabase expects the vector as a string like '[0.1, 0.2, ...]'
    // Ensure the input vector is an array of numbers before stringifying.
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
          model: model as string,
          vector: vectorString, // Pass the stringified vector
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
