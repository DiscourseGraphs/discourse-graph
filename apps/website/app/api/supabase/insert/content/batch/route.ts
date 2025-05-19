import { createClient } from "~/utils/supabase/server";
import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import {
  processAndInsertBatch,
  BatchItemValidator,
  BatchProcessResult,
} from "~/utils/supabase/dbUtils";

const ContentBatchItemSchema = z.object({
  text: z.string().min(1, { message: "Text cannot be empty." }),
  scale: z.string().min(1, { message: "Scale cannot be empty." }),
  space_id: z.number().int().positive(),
  author_id: z.number().int().positive(),
  document_id: z.number().int().positive(),
  source_local_id: z.string().optional(),
  metadata: z
    .union([z.record(z.string(), z.unknown()), z.string(), z.null()])
    .optional(),
  created: z
    .string()
    .datetime({ message: "Invalid ISO 8601 date format for created." }),
  last_modified: z
    .string()
    .datetime({ message: "Invalid ISO 8601 date format for last_modified." }),
  part_of_id: z.number().int().positive().optional(),
});

const ContentBatchRequestBodySchema = z.array(ContentBatchItemSchema).nonempty({
  message: "Request body must be a non-empty array of content items.",
});

type ContentBatchItemInput = z.infer<typeof ContentBatchItemSchema>;
type ContentBatchRequestBody = z.infer<typeof ContentBatchRequestBodySchema>;

type ContentRecord = {
  id: number;
  text: string;
  scale: string;
  space_id: number;
  author_id: number;
  document_id: number;
  source_local_id: string | null;
  metadata: Record<string, unknown> | null;
  created: string;
  last_modified: string;
  part_of_id: number | null;
};

const validateAndProcessContentItem: BatchItemValidator<
  ContentBatchItemInput,
  Omit<ContentBatchItemInput, "metadata" | "source_local_id" | "part_of_id"> & {
    metadata: string | null;
    source_local_id: string | null;
    part_of_id: number | null;
  }
> = (item, _index) => {
  let metadataString: string | null = null;
  if (item.metadata && typeof item.metadata === "object") {
    metadataString = JSON.stringify(item.metadata);
  } else if (typeof item.metadata === "string") {
    metadataString = item.metadata;
  } // item.metadata can also be null if provided as such

  return {
    valid: true,
    processedItem: {
      ...item,
      metadata: metadataString,
      source_local_id: item.source_local_id || null,
      part_of_id: item.part_of_id || null,
    },
  };
};

const batchInsertContentProcess = async (
  supabase: Awaited<ReturnType<typeof createClient>>,
  contentItems: ContentBatchRequestBody,
): Promise<BatchProcessResult<ContentRecord>> => {
  return processAndInsertBatch<
    ContentBatchItemInput,
    Omit<
      ContentBatchItemInput,
      "metadata" | "source_local_id" | "part_of_id"
    > & {
      metadata: string | null;
      source_local_id: string | null;
      part_of_id: number | null;
    },
    ContentRecord
  >(
    supabase,
    contentItems,
    "Content",
    "*",
    validateAndProcessContentItem,
    "Content",
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = await createClient();

  try {
    const body = await request.json();

    const validationResult = ContentBatchRequestBodySchema.safeParse(body);

    if (!validationResult.success) {
      const errorMessages = validationResult.error.errors
        .map((e) => `Item at path ${e.path.join(".")}: ${e.message}`)
        .join("; ");
      return createApiResponse(request, {
        error: "Validation Error",
        details: errorMessages,
        status: 400,
      });
    }

    const validatedContentItems = validationResult.data;

    const result = await batchInsertContentProcess(
      supabase,
      validatedContentItems,
    );

    return createApiResponse(request, {
      data: result.data,
      error: result.error,
      details: result.details,
      ...(result.partial_errors && {
        meta: { partial_errors: result.partial_errors },
      }),
      status: result.status,
      created: result.status === 201,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/content/batch");
  }
};

export const OPTIONS = defaultOptionsHandler;
