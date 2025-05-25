import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
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

type PlatformDataInput = TablesInsert<"Platform">;
type PlatformRecord = Tables<"Platform">;

const platformValidator: ItemValidator<PlatformDataInput> = (platform) => {
  const lowerCaseURL = platform.url?.toLowerCase();

  if (!lowerCaseURL.includes("roamresearch.com"))
    return "Could not determine platform from URL:";
  return null;
};

const getOrCreatePlatformFromURL = async (
  supabase: ReturnType<typeof createClient>,
  platform: PlatformDataInput,
): Promise<GetOrCreateEntityResult<PlatformRecord>> => {
  const error = platformValidator(platform);
  if (error !== null) {
    return {
      error,
      entity: null,
      created: false,
      status: 400,
    };
  }
  const lowerCaseURL = platform.url.toLowerCase();

  if (lowerCaseURL.includes("roamresearch.com")) {
    platform.name = "roamresearch";
    platform.url = "https://roamresearch.com";
  } else {
    throw Error("No path should reach here.");
  }

  const resolvedSupabaseClient = await supabase;
  return getOrCreateEntity<"Platform">(
    resolvedSupabaseClient,
    "Platform",
    "id, name, url",
    platform,
    platform,
    "Platform",
  );
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = createClient();

  try {
    const body: PlatformDataInput = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return createApiResponse(request, {
        error: "Missing or invalid url in request body.",
        status: 400,
      });
    }

    const result = await getOrCreatePlatformFromURL(supabase, body);

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/platform");
  }
};

export const OPTIONS = defaultOptionsHandler;
