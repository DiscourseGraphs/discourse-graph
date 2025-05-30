import { NextResponse, NextRequest } from "next/server";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";

import { createClient } from "~/utils/supabase/server";
import { getOrCreateEntity, ItemValidator } from "~/utils/supabase/dbUtils";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
  asPostgrestFailure,
} from "~/utils/supabase/apiUtils";
import { Tables, TablesInsert } from "@repo/database/types.gen.ts";

type PlatformDataInput = TablesInsert<"Platform">;
type PlatformRecord = Tables<"Platform">;

const platformValidator: ItemValidator<PlatformDataInput> = (platform) => {
  if (!platform || typeof platform !== "object")
    return "Invalid request body: expected a JSON object.";

  if (!platform.url || typeof platform.url !== "string") {
    return "Missing or invalid url field.";
  }

  const lowerCaseURL = platform.url.toLowerCase();

  if (!lowerCaseURL.includes("roamresearch.com"))
    return "Could not determine platform from URL:";
  return null;
};

const getOrCreatePlatformFromURL = async (
  supabasePromise: ReturnType<typeof createClient>,
  platform: PlatformDataInput,
): Promise<PostgrestSingleResponse<PlatformRecord>> => {
  const error = platformValidator(platform);
  if (error !== null) return asPostgrestFailure(error, "invalid");
  const lowerCaseURL = platform.url.toLowerCase();

  if (lowerCaseURL.includes("roamresearch.com")) {
    platform.name = "roamresearch";
    platform.url = "https://roamresearch.com";
  } else {
    throw Error("No path should reach here.");
  }

  const supabase = await supabasePromise;
  return getOrCreateEntity<"Platform">({
    supabase,
    tableName: "Platform",
    insertData: platform,
    uniqueOn: ["url"],
  });
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabase = createClient();

  try {
    const body: PlatformDataInput = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return createApiResponse(
        request,
        asPostgrestFailure(
          "Missing or invalid url in request body.",
          "invalid",
        ),
      );
    }

    const result = await getOrCreatePlatformFromURL(supabase, body);
    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/platform");
  }
};

export const OPTIONS = defaultOptionsHandler;
