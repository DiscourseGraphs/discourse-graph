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

type DiscoursePlatformRecord = {
  id: number;
  name: string;
  url: string;
};

type DiscoursePlatformDataInput = {
  currentContentURL: string;
};

const getOrCreateDiscoursePlatformFromURL = async (
  supabase: ReturnType<typeof createClient>,
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
  const supabase = createClient();

  try {
    const body: DiscoursePlatformDataInput = await request.json();
    const { currentContentURL } = body;

    if (!currentContentURL || typeof currentContentURL !== "string") {
      return createApiResponse(request, {
        error: "Missing or invalid currentContentURL in request body.",
        status: 400,
      });
    }

    const result = await getOrCreateDiscoursePlatformFromURL(
      supabase,
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
