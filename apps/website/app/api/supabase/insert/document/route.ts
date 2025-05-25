import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
  ItemValidator,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

type DocumentDataInput = TablesInsert<"Document">;
type DocumentRecord = Tables<"Document">;

const validateDocument: ItemValidator<DocumentDataInput> = (data) => {
  const { space_id, author_id } = data;

  if (!space_id) return "Missing required space_id field.";
  if (!author_id) return "Missing required author_id field.";
  return null;
};

const createDocument = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: DocumentDataInput,
): Promise<GetOrCreateEntityResult<DocumentRecord>> => {
  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<"Document">(
    supabase,
    "Document",
    "id, space_id, source_local_id, url, metadata, created, last_modified, author_id",
    { id: -1 },
    data,
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
        error: `Invalid space_id: No Space record found for ID ${data.space_id}.`,
      };
    }
    if (result.details.includes("author_id_fkey")) {
      return {
        ...result,
        error: `Invalid author_id: No Account record found for ID ${data.author_id}.`,
      };
    }
  }

  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: DocumentDataInput = await request.json();
    const error = validateDocument(body);
    if (error)
      return createApiResponse(request, {
        error,
        status: 400,
      });

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
