import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  defaultOptionsHandler,
  makeDefaultDeleteHandler,
  createApiResponse,
} from "~/utils/supabase/apiUtils";

export type SegmentDataType = { params: Promise<Record<string, string>> };

export const GET = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const { space_id, resource_id } = await segmentData.params;
  const spaceIdN = Number.parseInt(space_id || "NaN");
  if (isNaN(spaceIdN)) {
    return createApiResponse(
      request,
      asPostgrestFailure(`${space_id} is not a number`, "type"),
    );
  }
  const resourceIdN = Number.parseInt(resource_id || "NaN");
  if (isNaN(resourceIdN)) {
    return createApiResponse(
      request,
      asPostgrestFailure(`${resource_id} is not a number`, "type"),
    );
  }
  const supabase = await createClient();
  const spaceResponse = await supabase
    .from("Space")
    .select()
    .eq("id", spaceIdN)
    .maybeSingle();
  if (spaceResponse.error) {
    return createApiResponse(request, spaceResponse);
  }
  if (!spaceResponse.data) {
    // consideration: We may not see it because we don't have access,
    // so it would be worth re-fetching as superuser to see if I should redirect to login.
    return createApiResponse(
      request,
      asPostgrestFailure("Space not found", "401", 401),
    );
  }
  const conceptResponse = await supabase
    .from("Concept")
    .select()
    .eq("id", resourceIdN)
    .maybeSingle();
  if (conceptResponse.error) {
    return createApiResponse(request, conceptResponse);
  }
  const contentResponse = await supabase
    .from("Content")
    .select()
    .eq("id", resourceIdN)
    .maybeSingle();
  if (contentResponse.error) {
    return createApiResponse(request, conceptResponse);
  }
  if (!conceptResponse.data && !contentResponse.data) {
    return createApiResponse(
      request,
      asPostgrestFailure("Resource not found", "401", 401),
    );
  }
  const urlBasis = request.url;
  return createApiResponse(request, spaceResponse);
};

export const OPTIONS = defaultOptionsHandler;

export const DELETE = makeDefaultDeleteHandler("Content");
