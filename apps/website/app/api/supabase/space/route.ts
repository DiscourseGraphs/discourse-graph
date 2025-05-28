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

type SpaceDataInput = TablesInsert<"Space">;
type SpaceRecord = Tables<"Space">;

const spaceValidator: ItemValidator<SpaceDataInput> = (space) => {
  if (!space || typeof space !== "object")
    return "Invalid request body: expected a JSON object.";
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

const processAndGetOrCreateSpace = async (
  supabasePromise: ReturnType<typeof createClient>,
  data: SpaceDataInput,
): Promise<PostgrestSingleResponse<SpaceRecord>> => {
  const { name, url, platform_id } = data;
  const error = spaceValidator(data);
  if (error !== null) return asPostgrestFailure(error, "invalid");

  const normalizedUrl = url.trim().replace(/\/$/, "");
  const trimmedName = name.trim();
  const supabase = await supabasePromise;

  const result = await getOrCreateEntity<"Space">({
    supabase,
    tableName: "Space",
    insertData: {
      name: trimmedName,
      url: normalizedUrl,
      platform_id: platform_id,
    },
    uniqueOn: ["url"],
  });

  return result;
};

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const supabasePromise = createClient();

  try {
    const body: SpaceDataInput = await request.json();

    const result = await processAndGetOrCreateSpace(supabasePromise, body);
    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/space");
  }
};

export const OPTIONS = defaultOptionsHandler;
