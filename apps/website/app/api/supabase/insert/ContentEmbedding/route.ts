import { createClient } from "~/utils/supabase/server";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

// Based on LinkML for Embedding
interface ContentEmbeddingDataInput {
  target_id: number;
  model: string;
  vector: number[];
  obsolete?: boolean;
}

interface ContentEmbeddingResult {
  embedding: any | null;
  error: string | null;
  details?: string;
}

const TARGET_EMBEDDING_TABLE =
  "ContentEmbedding_openai_text_embedding_3_small_1536";

async function createContentEmbeddingEntry(
  supabase: SupabaseClient<any, "public", any>,
  data: ContentEmbeddingDataInput,
): Promise<ContentEmbeddingResult> {
  const { target_id, model, vector, obsolete = false } = data;

  if (target_id === undefined || target_id === null || !model || !vector) {
    return {
      embedding: null,
      error: "Missing required fields: target_id, model, or vector",
    };
  }

  if (!Array.isArray(vector) || !vector.every((v) => typeof v === "number")) {
    return {
      embedding: null,
      error: "Invalid vector format. Expected an array of numbers.",
    };
  }

  const vectorString = JSON.stringify(vector);

  const embeddingToInsert = {
    target_id,
    model,
    vector: vectorString,
    obsolete,
  };

  const { data: newEmbedding, error: insertError } = await supabase
    .from(TARGET_EMBEDDING_TABLE)
    .insert(embeddingToInsert)
    .select()
    .single();

  if (insertError) {
    console.error(
      `Error inserting new ContentEmbedding into ${TARGET_EMBEDDING_TABLE}:`,
      insertError,
    );
    if (
      insertError.code === "23503" &&
      insertError.message.includes("target_id_fkey")
    ) {
      return {
        embedding: null,
        error: `Invalid target_id: No Content record found for ID ${target_id}.`,
        details: insertError.message,
      };
    }
    return {
      embedding: null,
      error: "Database error while inserting ContentEmbedding",
      details: insertError.message,
    };
  }

  console.log(
    `Created new ContentEmbedding in ${TARGET_EMBEDDING_TABLE}:`,
    newEmbedding,
  );
  return { embedding: newEmbedding, error: null };
}

export async function POST(request: Request) {
  const supabase = await createClient();

  try {
    const body: ContentEmbeddingDataInput = await request.json();

    if (
      body.target_id === undefined ||
      body.target_id === null ||
      typeof body.target_id !== "number"
    ) {
      return NextResponse.json(
        { error: "Missing or invalid target_id" },
        { status: 400 },
      );
    }
    if (!body.model || typeof body.model !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid model name" },
        { status: 400 },
      );
    }
    if (
      !body.vector ||
      !Array.isArray(body.vector) ||
      !body.vector.every((v) => typeof v === "number")
    ) {
      return NextResponse.json(
        { error: "Missing or invalid vector. Must be an array of numbers." },
        { status: 400 },
      );
    }
    if (body.obsolete !== undefined && typeof body.obsolete !== "boolean") {
      return NextResponse.json(
        { error: "Invalid type for obsolete. Must be a boolean." },
        { status: 400 },
      );
    }

    const { embedding, error, details } = await createContentEmbeddingEntry(
      supabase,
      body,
    );

    if (error) {
      console.error(
        `API Error for ContentEmbedding creation: ${error}`,
        details || "",
      );
      if (
        error.startsWith("Invalid target_id") ||
        error.startsWith("Invalid vector format")
      ) {
        return NextResponse.json(
          { error: error, details: details },
          { status: 400 },
        );
      }
      const clientError = error.startsWith("Database error")
        ? "An internal error occurred while processing ContentEmbedding."
        : error;
      return NextResponse.json(
        { error: clientError, details: details },
        { status: 500 },
      );
    }

    return NextResponse.json(embedding, { status: 201 });
  } catch (e: any) {
    console.error(
      "API route error in /api/supabase/insert/ContentEmbedding:",
      e,
    );
    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { error: "An unexpected error occurred processing your request" },
      { status: 500 },
    );
  }
}
