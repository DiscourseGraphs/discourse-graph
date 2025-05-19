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

type DiscourseSpaceDataInput = {
  name: string;
  url: string;
  discourse_platform_id: number;
};

type DiscourseSpaceRecord = {
  id: number;
  name: string;
  url: string;
  discourse_platform_id: number;
  // Add other fields from your DiscourseSpace table if they are selected
};

// Renamed and refactored helper function
const processAndGetOrCreateDiscourseSpace = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: DiscourseSpaceDataInput,
): Promise<GetOrCreateEntityResult<DiscourseSpaceRecord>> => {
  const { name, url, discourse_platform_id } = data;

  // --- Start of validation ---
  if (!name || typeof name !== "string" || name.trim() === "") {
    return {
      entity: null,
      error: "Missing or invalid name.",
      created: false,
      status: 400,
    };
  }
  if (!url || typeof url !== "string" || url.trim() === "") {
    return {
      entity: null,
      error: "Missing or invalid URL.",
      created: false,
      status: 400,
    };
  }
  if (
    discourse_platform_id === undefined ||
    discourse_platform_id === null ||
    typeof discourse_platform_id !== "number"
  ) {
    return {
      entity: null,
      error: "Missing or invalid discourse_platform_id.",
      created: false,
      status: 400,
    };
  }
  // --- End of validation ---

  const normalizedUrl = url.trim().replace(/\/$/, "");
  const trimmedName = name.trim();
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

  // Custom handling for specific foreign key error related to discourse_platform_id
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
    const body: DiscourseSpaceDataInput = await request.json();

    // Minimal validation here, more detailed in the helper
    if (!body || typeof body !== "object") {
      return createApiResponse(request, {
        error: "Invalid request body: expected a JSON object.",
        status: 400,
      });
    }

    const result = await processAndGetOrCreateDiscourseSpace(
      supabasePromise,
      body,
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
