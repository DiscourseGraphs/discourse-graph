import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import cors from "~/utils/llm/cors";

interface ItemInput {
  nodeUid: string; // Document's source_local_id
  blockUid: string; // Content's source_local_id
  blockString: string; // Content's text
  childCreateTime: string;
  childEditTime: string;
}

interface RequestBody {
  spaceId: number;
  authorId: number;
  items: ItemInput[];
}

async function batchUpsertContentForPage(
  supabase: SupabaseClient<any, "public", any>,
  { spaceId, authorId, items }: RequestBody,
) {
  if (!spaceId || !authorId || !items || !Array.isArray(items)) {
    return {
      error: "Missing required fields: spaceId, authorId, or items.",
      status: 400,
    };
  }

  const nodeUids = items.map((i) => i.nodeUid);
  const { data: documents, error: docsError } = await supabase
    .from("Document")
    .select("id, source_local_id")
    .in("source_local_id", nodeUids)
    .eq("space_id", spaceId);

  if (docsError) {
    console.error("Error fetching documents:", docsError);
    return { error: "Database error fetching documents.", status: 500 };
  }

  const docIdMap = new Map(documents.map((d) => [d.source_local_id, d.id]));

  const contentToUpsert = items
    .map((item) => ({
      document_id: docIdMap.get(item.nodeUid),
      source_local_id: item.blockUid,
      text: item.blockString,
      space_id: spaceId,
      author_id: authorId,
      creator_id: authorId,
      scale: "block",
      created: item.childCreateTime,
      last_modified: item.childEditTime,
      metadata: { useForEmbedding: true },
    }))
    .filter((item) => item.document_id !== undefined);

  if (contentToUpsert.length === 0) {
    return { data: [], status: 200 }; // Nothing to upsert
  }

  const { data, error } = await supabase
    .from("Content")
    .upsert(contentToUpsert, { onConflict: "space_id, source_local_id" })
    .select();

  if (error) {
    console.error("Error upserting content:", error);
    return { error: "Database error upserting content.", status: 500 };
  }

  return { data, status: 201 };
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let response: NextResponse;

  try {
    const body: RequestBody = await request.json();
    const { data, error, status } = await batchUpsertContentForPage(
      supabase,
      body,
    );

    if (error) {
      response = NextResponse.json({ error }, { status });
    } else {
      response = NextResponse.json(data, { status });
    }
  } catch (e: any) {
    response = NextResponse.json(
      { error: "An unexpected error occurred." },
      { status: 500 },
    );
  }

  return cors(request, response) as NextResponse;
}

export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return cors(request, response) as NextResponse;
}
