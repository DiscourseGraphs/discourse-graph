import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

// Based on the Content table schema and usage in embeddingWorkflow.ts
// This is for a single content item in the batch
interface ContentBatchItemInput {
  text: string;
  scale: string;
  space_id: number;
  author_id: number; // This is Person.id (Agent.id)
  document_id: number;
  source_local_id?: string;
  metadata?: Record<string, unknown> | string | null; // Allow string for pre-stringified, or null
  created: string;
  last_modified: string;
  part_of_id?: number;
}

// The request body will be an array of these items
type ContentBatchRequestBody = ContentBatchItemInput[];

// The response will be an array of created content items (or an error object)
interface ContentBatchResult {
  data?: any[]; // Array of successfully created content records
  error?: string;
  details?: string;
  partial_errors?: { index: number; error: string; details?: string }[];
}

async function batchInsertContent(
  supabase: SupabaseClient<any, "public", any>,
  contentItems: ContentBatchRequestBody,
): Promise<ContentBatchResult> {
  if (!Array.isArray(contentItems) || contentItems.length === 0) {
    return {
      error: "Request body must be a non-empty array of content items.",
    };
  }

  const processedContentItems = contentItems.map((item, i) => {
    if (!item) {
      // This case should ideally not happen if contentItems is a valid array of objects
      // but it satisfies the linter if it's worried about sparse arrays or undefined elements.
      throw new Error(
        `Validation Error: Item at index ${i} is undefined or null.`,
      );
    }
    if (
      !item.text ||
      !item.scale ||
      !item.space_id ||
      !item.author_id ||
      !item.document_id ||
      !item.created ||
      !item.last_modified
    ) {
      throw new Error(
        `Validation Error: Item at index ${i} is missing required fields (text, scale, space_id, author_id, document_id, created, last_modified).`,
      );
    }

    let metadataString: string | null = null;
    if (item.metadata && typeof item.metadata === "object") {
      metadataString = JSON.stringify(item.metadata);
    } else if (typeof item.metadata === "string") {
      metadataString = item.metadata;
    } else {
      metadataString = null;
    }

    return {
      ...item,
      metadata: metadataString,
    };
  });

  const { data: newContents, error: insertError } = await supabase
    .from("Content")
    .upsert(processedContentItems) // Use the validated and processed items
    .select(); // Select all columns of the inserted rows, including the 'id'

  if (insertError) {
    console.error("Error batch inserting Content:", insertError);
    return {
      error: "Database error during batch insert of Content.",
      details: insertError.message,
    };
  }

  if (!newContents || newContents.length !== processedContentItems.length) {
    console.warn(
      "Batch insert Content: Mismatch between input and output count or no data returned.",
      {
        inputCount: processedContentItems.length,
        outputCount: newContents?.length,
      },
    );
    return {
      error:
        "Batch insert of Content might have partially failed or returned unexpected data.",
    };
  }

  console.log(
    `Successfully batch inserted ${newContents.length} Content records.`,
  );
  return { data: newContents };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: ContentBatchRequestBody = await request.json();
    const result = await batchInsertContent(supabase, body);

    if (result.error) {
      console.error(
        `API Error for batch Content creation: ${result.error}`,
        result.details || "",
      );
      const statusCode = result.error.startsWith("Validation Error:")
        ? 400
        : 500;
      response = NextResponse.json(
        { error: result.error, details: result.details },
        { status: statusCode },
      );
    } else {
      response = NextResponse.json(result.data, { status: 201 });
    }
  } catch (e: any) {
    console.error("API route error in /api/supabase/insert/Content/batch:", e);
    if (e instanceof SyntaxError && e.message.toLowerCase().includes("json")) {
      response = NextResponse.json(
        {
          error:
            "Invalid JSON in request body. Expected an array of content items.",
        },
        { status: 400 },
      );
    } else if (e.message?.startsWith("Validation Error:")) {
      // Catch errors thrown from batchInsertContent validation
      response = NextResponse.json({ error: e.message }, { status: 400 });
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
