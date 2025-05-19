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

const DiscourseSpaceDataInputSchema = z.object({
  name: z.string().trim().min(1, { message: "Name cannot be empty." }),
  url: z
    .string()
    .trim()
    .url({ message: "Invalid URL format." })
    .min(1, { message: "URL cannot be empty." }),
  discourse_platform_id: z
    .number()
    .int()
    .positive({ message: "discourse_platform_id must be a positive integer." }),
});

type DiscourseSpaceDataInput = z.infer<typeof DiscourseSpaceDataInputSchema>;

type DiscourseSpaceRecord = {
  id: number;
  name: string;
  url: string;
  discourse_platform_id: number;
};

const processAndGetOrCreateDiscourseSpace = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: DiscourseSpaceDataInput, // data is now Zod-validated
): Promise<GetOrCreateEntityResult<DiscourseSpaceRecord>> => {
  const { name, url, discourse_platform_id } = data;

  const normalizedUrl = url.replace(/\/$/, "");
  const trimmedName = name;

  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<DiscourseSpaceRecord>(
    supabase,
    "DiscourseSpace",
    "id, name, url, discourse_platform_id",
    { url: normalizedUrl, discourse_platform_id: discourse_platform_id },
    {
      name: trimmedName,
      url: normalizedUrl,
      discourse_platform_id: discourse_platform_id,
    },
    "DiscourseSpace",
  );

  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    if (
      result.details
        .toLowerCase()
        .includes("discoursespace_discourse_platform_id_fkey") ||
      result.details.toLowerCase().includes("discourse_platform_id")
    ) {
      return {
        ...result,
        error: `Invalid discourse_platform_id: No DiscoursePlatform record found for ID ${discourse_platform_id}.`,
      };
    }
  }

  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();

    const validationResult = DiscourseSpaceDataInputSchema.safeParse(body);

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

    const result = await processAndGetOrCreateDiscourseSpace(
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
    return handleRouteError(request, e, "/api/supabase/insert/discourse-space");
  }
};

export const OPTIONS = defaultOptionsHandler;
