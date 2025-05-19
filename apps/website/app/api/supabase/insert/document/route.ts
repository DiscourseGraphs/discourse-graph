import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import {
  getOrCreateEntity,
  GetOrCreateEntityResult,
} from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";

const DocumentDataInputSchema = z.object({
  space_id: z
    .number()
    .int()
    .positive({ message: "space_id must be a positive integer." }),
  source_local_id: z.string().optional(),
  url: z.string().url({ message: "Invalid URL format." }).optional(),
  metadata: z
    .union([z.record(z.string(), z.unknown()), z.string()])
    .nullable()
    .optional(),
  created: z
    .string()
    .datetime({ message: "Invalid ISO 8601 date format for created." }),
  last_modified: z
    .string()
    .datetime({ message: "Invalid ISO 8601 date format for last_modified." }),
  author_id: z
    .number()
    .int()
    .positive({ message: "author_id must be a positive integer." }),
});

type DocumentDataInput = z.infer<typeof DocumentDataInputSchema>;

type DocumentRecord = {
  id: number;
  space_id: number;
  source_local_id: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
  created: string;
  last_modified: string;
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
    metadata,
    created,
    last_modified,
    author_id,
  } = data;
  const processedMetadata =
    metadata && typeof metadata === "object"
      ? JSON.stringify(metadata)
      : typeof metadata === "string"
        ? metadata
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
    const body = await request.json();

    const validationResult = DocumentDataInputSchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return createApiResponse(request, {
        error: "Validation Error",
        details: errorMessages,
        status: 400,
      });
    }

    const validatedData = validationResult.data;

    const result = await createDocument(supabasePromise, validatedData);

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
