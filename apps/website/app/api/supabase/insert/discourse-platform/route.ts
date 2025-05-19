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

type DiscoursePlatformRecord = {
  id: number;
  name: string;
  url: string;
};

const DiscoursePlatformDataInputSchema = z.object({
  currentContentURL: z
    .string({
      required_error: "currentContentURL is required.",
      invalid_type_error: "currentContentURL must be a string.",
    })
    .trim()
    .min(1, { message: "currentContentURL cannot be empty." })
    .url({ message: "Invalid URL format for currentContentURL." }),
});

const getOrCreateDiscoursePlatformFromURL = async (
  supabasePromise: ReturnType<typeof createClient>,
  currentContentURL: string,
): Promise<GetOrCreateEntityResult<DiscoursePlatformRecord>> => {
  let platformName: string | null = null;
  let platformUrl: string | null = null;
  const lowerCaseURL = currentContentURL.toLowerCase();

  if (lowerCaseURL.includes("roamresearch.com")) {
    platformName = "roamresearch";
    platformUrl = "https://roamresearch.com";
  } else {
    console.warn("Could not determine platform from URL:", currentContentURL);
    return {
      error:
        "Could not determine platform from URL. Ensure it is a supported platform URL.",
      entity: null,
      created: false,
      status: 400,
    };
  }

  if (!platformName || !platformUrl) {
    return {
      error: "Platform name or URL could not be derived even from a valid URL.",
      entity: null,
      created: false,
      status: 400,
    };
  }

  const resolvedSupabaseClient = await supabasePromise;
  return getOrCreateEntity<DiscoursePlatformRecord>(
    resolvedSupabaseClient,
    "DiscoursePlatform",
    "id, name, url",
    { url: platformUrl },
    { name: platformName, url: platformUrl },
    "DiscoursePlatform",
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body = await request.json();

    const validationResult = DiscoursePlatformDataInputSchema.safeParse(body);

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

    const { currentContentURL } = validationResult.data;

    const result = await getOrCreateDiscoursePlatformFromURL(
      supabasePromise,
      currentContentURL,
    );

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(
      request,
      e,
      "/api/supabase/insert/discourse-platform",
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
