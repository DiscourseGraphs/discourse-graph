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
import { Tables, TablesInsert } from "~/utils/supabase/types.gen";

type PlatformDataInput = TablesInsert<"Platform">;
type PlatformRecord = Tables<"Platform">;

const getOrCreatePlatformFromURL = async (
  supabase: ReturnType<typeof createClient>,
  url: string,
): Promise<GetOrCreateEntityResult<PlatformRecord>> => {
  let platformName: string | null = null;
  let platformUrl: string | null = null;
  const lowerCaseURL = url.toLowerCase();

  if (lowerCaseURL.includes("roamresearch.com")) {
    platformName = "roamresearch";
    platformUrl = "https://roamresearch.com";
  } else {
    console.warn("Could not determine platform from URL:", url);
    return {
      error: "Could not determine platform from URL.",
      entity: null,
      created: false,
      status: 400,
    };
  }

  if (!platformName || !platformUrl) {
    return {
      error: "Platform name or URL could not be derived.",
      entity: null,
      created: false,
      status: 400,
    };
  }

  const resolvedSupabaseClient = await supabase;
  return getOrCreateEntity<"Platform">(
    resolvedSupabaseClient,
    "Platform",
    "id, name, url",
    { url: platformUrl },
    { name: platformName, url: platformUrl },
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

    const result = await getOrCreatePlatformFromURL(supabase, url);

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
