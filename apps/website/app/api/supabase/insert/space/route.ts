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

type SpaceDataInput = TablesInsert<"Space">;
type SpaceRecord = Tables<"Space">;

// Renamed and refactored helper function
const processAndGetOrCreateSpace = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: SpaceDataInput,
): Promise<GetOrCreateEntityResult<SpaceRecord>> => {
  const { name, url, platform_id } = data;

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
    platform_id === undefined ||
    platform_id === null ||
    typeof platform_id !== "number"
  ) {
    return {
      entity: null,
      error: "Missing or invalid platform_id.",
      created: false,
      status: 400,
    };
  }
  // --- End of validation ---

  const normalizedUrl = url.trim().replace(/\/$/, "");
  const trimmedName = name.trim();
  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<"Space">(
    supabase,
    "Space",
    "id, name, url, platform_id",
    { url: normalizedUrl, platform_id: platform_id },
    {
      name: trimmedName,
      url: normalizedUrl,
      platform_id: platform_id,
    },
    "Space",
  );

  // Custom handling for specific foreign key error related to platform_id
  if (
    result.error &&
    result.details &&
    result.status === 400 &&
    result.details.includes("violates foreign key constraint")
  ) {
    if (
      result.details.toLowerCase().includes("platform_id_fkey") ||
      result.details.toLowerCase().includes("platform_id")
    ) {
      return {
        ...result,
        error: `Invalid platform_id: No Space record found for ID ${platform_id}.`,
      };
    }
  }

  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: SpaceDataInput = await request.json();

    // Minimal validation here, more detailed in the helper
    if (!body || typeof body !== "object") {
      return createApiResponse(request, {
        error: "Invalid request body: expected a JSON object.",
        status: 400,
      });
    }

    const result = await processAndGetOrCreateSpace(supabasePromise, body);

    return createApiResponse(request, {
      data: result.entity,
      error: result.error,
      details: result.details,
      status: result.status,
      created: result.created,
    });
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/insert/space");
  }
};

export const OPTIONS = defaultOptionsHandler;
