import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  defaultOptionsHandler,
  createApiResponse,
} from "~/utils/supabase/apiUtils";
import { Tables } from "@repo/database/dbTypes";

type Space = Tables<"Space">;

export type SegmentDataType = { params: Promise<Record<string, string>> };

export const GET = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const { space_id } = await segmentData.params;
  const spaceIdN = Number.parseInt(space_id || "NaN");
  if (isNaN(spaceIdN)) {
    return createApiResponse(
      request,
      asPostgrestFailure(`${space_id} is not a number`, "type"),
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
  const space: Space = spaceResponse.data;
  const conceptResponse = await supabase
    .from("Concept")
    .select("id, last_modified")
    .eq("space_id", space.id);
  if (conceptResponse.error) {
    return createApiResponse(request, conceptResponse);
  }
  const concepts = conceptResponse.data;
  if (!concepts) {
    return createApiResponse(
      request,
      asPostgrestFailure("Resources not found", "401", 401),
    );
  }
  const baseUrl = request.url + "/";
  const rootUrl = baseUrl.split("/").slice(0, 3).join("/");
  const ctxUrl = rootUrl + "/schema/context.jsonld";
  const localCtx: Record<string, string> = {
    sdata: baseUrl + "/",
  };
  const data = {
    "@context": [ctxUrl, localCtx],
    "@id": baseUrl,
    "@type": "Space",
    content: concepts.map(({ id, last_modified }) => ({
      "@id": `sdata:${id}`,
      modified: last_modified + "Z",
    })),
  };
  return NextResponse.json(data, {
    status: 200,
    headers: { "Content-Type": "application/ld+json" },
  });
};

export const OPTIONS = defaultOptionsHandler;
