import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface DocumentDataInput {
  space_id: number;
  source_local_id?: string;
  url?: string;
  metadata?: Record<string, unknown>;
  created: string;
  last_modified: string;
  last_synced: string;
  author_id: number;
}

interface DocumentResult {
  document: any | null;
  error: string | null;
  details?: string;
}

async function createDocumentEntry(
  supabase: SupabaseClient<any, "public", any>,
  data: DocumentDataInput,
): Promise<DocumentResult> {
  const {
    space_id,
    source_local_id,
    url,
    metadata,
    created,
    last_modified,
    last_synced,
    author_id,
  } = data;

  // Validate required fields
  if (!space_id || !created || !last_modified || !author_id) {
    return {
      document: null,
      error:
        "Missing required fields: space_id, created, last_modified, or author_id",
    };
  }

  const documentToInsert = {
    space_id,
    source_local_id,
    url,
    metadata: metadata ? JSON.stringify(metadata) : "{}",
    created,
    last_modified,
    last_synced,
    author_id,
  };

  const { data: newDocument, error: insertError } = await supabase
    .from("Document")
    .insert(documentToInsert)
    .select()
    .single();

  if (insertError) {
    console.error("Error inserting new Document:", insertError);
    if (insertError.code === "23503") {
      if (insertError.message.includes("space_id_fkey")) {
        return {
          document: null,
          error: `Invalid space_id: No Space record found for ID ${space_id}.`,
          details: insertError.message,
        };
      }
      if (insertError.message.includes("author_id_fkey")) {
        return {
          document: null,
          error: `Invalid author_id: No Account record found for ID ${author_id}.`,
          details: insertError.message,
        };
      }
    }
    return {
      document: null,
      error: "Database error while inserting Document",
      details: insertError.message,
    };
  }

  console.log("Created new Document:", newDocument);
  return { document: newDocument, error: null };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: DocumentDataInput = await request.json();

    // Validate required fields
    if (body.space_id === undefined || body.space_id === null) {
      response = NextResponse.json(
        { error: "Missing required field: space_id" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (!body.created) {
      response = NextResponse.json(
        { error: "Missing required field: created" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (!body.last_modified) {
      response = NextResponse.json(
        { error: "Missing required field: last_modified" },
        { status: 400 },
      );
      return cors(request, response);
    }
    if (body.author_id === undefined || body.author_id === null) {
      response = NextResponse.json(
        { error: "Missing required field: author_id" },
        { status: 400 },
      );
      return cors(request, response);
    }

    const { document, error, details } = await createDocumentEntry(
      supabase,
      body,
    );

    if (error) {
      console.error(`API Error for Document creation: ${error}`, details || "");
      if (
        error.startsWith("Invalid") ||
        error.startsWith("Missing required fields")
      ) {
        response = NextResponse.json(
          { error: error, details: details },
          { status: 400 },
        );
      } else {
        const clientError = error.startsWith("Database error")
          ? "An internal error occurred while processing Document."
          : error;
        response = NextResponse.json(
          { error: clientError, details: details },
          { status: 500 },
        );
      }
    } else {
      response = NextResponse.json(document, { status: 201 });
    }
  } catch (e: any) {
    console.error("API route error in /api/supabase/insert/Document:", e);
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
  return cors(request, response);
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response);
}
