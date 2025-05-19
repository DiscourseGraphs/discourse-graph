import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import cors from "~/utils/llm/cors";

type DocumentDataInput = {
  space_id: number;
  source_local_id?: string;
  url?: string;
  metadata?: Record<string, unknown> | string;
  created: string; // ISO 8601 date string
  last_modified: string; // ISO 8601 date string
  author_id: number;
};

type DocumentRecord = {
  id: number;
  space_id: number;
  source_local_id: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
  created: string; // ISO 8601 date string
  last_modified: string; // ISO 8601 date string
  author_id: number;
};

const createDocument = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: DocumentDataInput,
): Promise<GetOrCreateEntityResult<DocumentRecord>> => {
  const {
    space_id,
    source_local_id,
    url,
    metadata: rawMetadata,
    created,
    last_modified,
    author_id,
  } = data;

  if (
    space_id === undefined ||
    space_id === null ||
    !created ||
    !last_modified ||
    author_id === undefined ||
    author_id === null
  ) {
    return {
      entity: null,
      error:
        "Missing required fields: space_id, created, last_modified, or author_id.",
      created: false,
      status: 400,
    };
  }

  const processedMetadata =
    rawMetadata && typeof rawMetadata === "object"
      ? JSON.stringify(rawMetadata)
      : typeof rawMetadata === "string"
        ? rawMetadata
        : null;

  const documentToInsert = {
    space_id,
    source_local_id: source_local_id || null,
    url: url || null,
    metadata: processedMetadata as any,
    created,
    last_modified,
    author_id,
  };

  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<DocumentRecord>(
    supabase,
    "Document",
    "id, space_id, source_local_id, url, metadata, created, last_modified, author_id",
    { id: -1 },
    documentToInsert,
    "Document",
  );

  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    if (result.details.includes("space_id_fkey")) {
      return {
        ...result,
        error: `Invalid space_id: No Space record found for ID ${space_id}.`,
      };
    }
    if (result.details.includes("author_id_fkey")) {
      return {
        ...result,
        error: `Invalid author_id: No Account record found for ID ${author_id}.`,
      };
    }
  }

  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: DocumentDataInput = await request.json();

    if (body.space_id === undefined || body.space_id === null) {
      return createApiResponse(request, {
        error: "Missing required field: space_id.",
        status: 400,
      });
    }
    if (!body.created) {
      return createApiResponse(request, {
        error: "Missing required field: created.",
        status: 400,
      });
    }
    if (!body.last_modified) {
      return createApiResponse(request, {
        error: "Missing required field: last_modified.",
        status: 400,
      });
    }
    if (body.author_id === undefined || body.author_id === null) {
      return createApiResponse(request, {
        error: "Missing required field: author_id.",
        status: 400,
      });
    }

    const result = await createDocument(supabasePromise, body);

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/document");
  }
};

export const OPTIONS = defaultOptionsHandler;
