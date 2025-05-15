import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

// Based on the Content table schema and usage in embeddingWorkflow.ts
interface ContentDataInput {
  text: string;
  scale: string;
  space_id: number;
  author_id: number;
  source_local_id?: string;
  metadata?: Record<string, unknown>;
  created: string;
  last_modified: string;
  document_id?: number;
  part_of_id?: number;
  represents_id?: number;
}

interface ContentResult {
  content: any | null;
  error: string | null;
  details?: string;
}

async function createContentEntry(
  supabase: SupabaseClient<any, "public", any>,
  data: ContentDataInput,
): Promise<ContentResult> {
  const {
    text,
    scale,
    space_id,
    author_id,
    source_local_id,
    metadata,
    created,
    last_modified,
    document_id,
    part_of_id,
    represents_id,
  } = data;

  // Validate required fields
  if (
    !text ||
    !scale ||
    !space_id ||
    !author_id ||
    !created ||
    !last_modified
  ) {
    return {
      content: null,
      error:
        "Missing required fields: text, scale, space_id, author_id, created, or last_modified",
    };
  }

  // Check for existing Content with same space_id and source_local_id
  if (source_local_id) {
    const { data: existingContent, error: existingError } = await supabase
      .from("Content")
      .select("*")
      .eq("space_id", space_id)
      .eq("source_local_id", source_local_id)
      .maybeSingle();
    if (existingContent) {
      return { content: existingContent, error: null };
    }
    if (existingError && existingError.code !== "PGRST116") {
      // PGRST116: No rows found
      return {
        content: null,
        error: "Database error while checking for existing Content",
        details: existingError.message,
      };
    }
  }

  // Validate field types
  if (typeof text !== "string") {
    return {
      content: null,
      error: "Invalid text format. Expected a string.",
    };
  }

  if (typeof scale !== "string") {
    return {
      content: null,
      error: "Invalid scale format. Expected a string.",
    };
  }

  if (typeof space_id !== "number") {
    return {
      content: null,
      error: "Invalid space_id format. Expected a number.",
    };
  }

  if (typeof author_id !== "number") {
    return {
      content: null,
      error: "Invalid author_id format. Expected a number.",
    };
  }

  // Validate dates
  try {
    new Date(created);
    new Date(last_modified);
  } catch (e) {
    return {
      content: null,
      error: "Invalid date format for created or last_modified",
    };
  }

  const contentToInsert = {
    text,
    scale,
    space_id,
    author_id,
    source_local_id,
    metadata: metadata ? JSON.stringify(metadata) : null,
    created,
    last_modified,
    document_id,
    part_of_id,
    represents_id,
  };

  const { data: newContent, error: insertError } = await supabase
    .from("Content")
    .insert(contentToInsert)
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting new Content:", insertError);

    // Handle foreign key constraint violations
    if (insertError.code === "23503") {
      if (insertError.message.includes("space_id_fkey")) {
        return {
          content: null,
          error: `Invalid space_id: No DiscourseSpace record found for ID ${space_id}.`,
          details: insertError.message,
        };
      }
      if (insertError.message.includes("author_id_fkey")) {
        return {
          content: null,
          error: `Invalid author_id: No Account record found for ID ${author_id}.`,
          details: insertError.message,
        };
      }
      if (insertError.message.includes("document_id_fkey")) {
        return {
          content: null,
          error: `Invalid document_id: No Document record found for ID ${document_id}.`,
          details: insertError.message,
        };
      }
      if (insertError.message.includes("part_of_id_fkey")) {
        return {
          content: null,
          error: `Invalid part_of_id: No Content record found for ID ${part_of_id}.`,
          details: insertError.message,
        };
      }
      if (insertError.message.includes("represents_id_fkey")) {
        return {
          content: null,
          error: `Invalid represents_id: No Content record found for ID ${represents_id}.`,
          details: insertError.message,
        };
      }
    }

    return {
      content: null,
      error: "Database error while inserting Content",
      details: insertError.message,
    };
  }

  console.log("Created new Content:", newContent);
  return { content: newContent, error: null };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: ContentDataInput = await request.json();

    // Validate required fields
    if (!body.text) {
      response = NextResponse.json(
        { error: "Missing required field: text" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (!body.scale) {
      response = NextResponse.json(
        { error: "Missing required field: scale" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (body.space_id === undefined || body.space_id === null) {
      response = NextResponse.json(
        { error: "Missing required field: space_id" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (body.author_id === undefined || body.author_id === null) {
      response = NextResponse.json(
        { error: "Missing required field: author_id" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (!body.created) {
      response = NextResponse.json(
        { error: "Missing required field: created" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }
    if (!body.last_modified) {
      response = NextResponse.json(
        { error: "Missing required field: last_modified" },
        { status: 400 },
      );
      return cors(request, response) as NextResponse;
    }

    const { content, error, details } = await createContentEntry(
      supabase,
      body,
    );

    if (error) {
      console.error(`API Error for Content creation: ${error}`, details || "");

      // Handle validation errors
      if (
        error.startsWith("Invalid") ||
        error.startsWith("Missing required fields")
      ) {
        response = NextResponse.json(
          { error: error, details: details },
          { status: 400 },
        );
      } else {
        // Handle database errors
        const clientError = error.startsWith("Database error")
          ? "An internal error occurred while processing Content."
          : error;
        response = NextResponse.json(
          { error: clientError, details: details },
          { status: 500 },
        );
      }
    } else {
      response = NextResponse.json(content, { status: 201 });
    }
  } catch (e: any) {
    console.error("API route error in /api/supabase/insert/Content:", e);
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
