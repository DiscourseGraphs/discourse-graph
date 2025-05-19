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

const ContentDataInputSchema = z.object({
  text: z.string().min(1, { message: "Text cannot be empty." }),
  scale: z.string().min(1, { message: "Scale cannot be empty." }),
  space_id: z
    .number()
    .int()
    .positive({ message: "space_id must be a positive integer." }),
  author_id: z
    .number()
    .int()
    .positive({ message: "author_id must be a positive integer." }),
  source_local_id: z.string().optional(),
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
  document_id: z.number().int().positive().optional(),
  part_of_id: z.number().int().positive().optional(),
});

type ContentDataInput = z.infer<typeof ContentDataInputSchema>;

type ContentRecord = {
  id: number;
  text: string;
  scale: string;
  space_id: number;
  author_id: number;
  source_local_id: string | null;
  metadata: Record<string, unknown> | null;
  created: string;
  last_modified: string;
  document_id: number | null;
  part_of_id: number | null;
};

const processAndUpsertContentEntry = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: ContentDataInput,
): Promise<GetOrCreateEntityResult<ContentRecord>> => {
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
  } = data;

  const processedMetadata =
    metadata && typeof metadata === "object"
      ? JSON.stringify(metadata)
      : typeof metadata === "string"
        ? metadata
        : null;

  const supabase = await supabasePromise;

  const contentToInsertOrUpdate = {
    text,
    scale,
    space_id,
    author_id,
    source_local_id: source_local_id || null,
    metadata: processedMetadata as any,
    created,
    last_modified,
    document_id: document_id || null,
    part_of_id: part_of_id || null,
  };

  let matchCriteria: Record<string, any> | null = null;
  if (
    data.source_local_id &&
    data.space_id !== undefined &&
    data.space_id !== null
  ) {
    matchCriteria = {
      space_id: data.space_id,
      source_local_id: data.source_local_id,
    };
  }

  const result = await getOrCreateEntity<ContentRecord>(
    supabase,
    "Content",
    "*",
    matchCriteria || { id: -1 },
    contentToInsertOrUpdate,
    "Content",
  );

  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    const details = result.details.toLowerCase();
    if (
      details.includes("content_space_id_fkey") ||
      details.includes("space_id")
    ) {
      return {
        ...result,
        error: `Invalid space_id: No DiscourseSpace record found for ID ${space_id}.`,
      };
    }
    if (
      details.includes("content_author_id_fkey") ||
      details.includes("author_id")
    ) {
      return {
        ...result,
        error: `Invalid author_id: No Account record found for ID ${author_id}.`,
      };
    }
    if (
      document_id &&
      (details.includes("content_document_id_fkey") ||
        details.includes("document_id"))
    ) {
      return {
        ...result,
        error: `Invalid document_id: No Document record found for ID ${document_id}.`,
      };
    }
    if (
      part_of_id &&
      (details.includes("content_part_of_id_fkey") ||
        details.includes("part_of_id"))
    ) {
      return {
        ...result,
        error: `Invalid part_of_id: No Content record found for ID ${part_of_id}.`,
      };
    }
  }
  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();

    const validationResult = ContentDataInputSchema.safeParse(body);

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

    const result = await processAndUpsertContentEntry(
      supabasePromise,
      validatedData,
    );

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/content");
  }
};

export const OPTIONS = defaultOptionsHandler;
