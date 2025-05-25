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

type SpaceDataInput = TablesInsert<"Space">;
type SpaceRecord = Tables<"Space">;

const spaceValidator: ItemValidator<SpaceDataInput> = (space) => {
  const { name, url, platform_id } = space;

  if (!name || typeof name !== "string" || name.trim() === "")
    return "Missing or invalid name.";
  if (!url || typeof url !== "string" || url.trim() === "")
    return "Missing or invalid URL.";
  if (
    platform_id === undefined ||
    platform_id === null ||
    typeof platform_id !== "number"
  )
    return "Missing or invalid platform_id.";
  return null;
};

// Renamed and refactored helper function
const processAndGetOrCreateSpace = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: SpaceDataInput,
): Promise<GetOrCreateEntityResult<SpaceRecord>> => {
  const { name, url, platform_id } = data;
  const error = spaceValidator(data);
  if (error !== null) {
    return {
      entity: null,
      error: error,
      created: false,
      status: 400,
    };
  }

  const normalizedUrl = url ? url.trim().replace(/\/$/, "") : null;
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
