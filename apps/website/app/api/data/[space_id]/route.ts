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
  const afterParam = request.nextUrl.searchParams.get("after");
  let after: Date | undefined = undefined;
  if (afterParam)
    try {
      after = new Date(afterParam);
    } catch (error) {
      return createApiResponse(
        request,
        asPostgrestFailure(`${after} is not a date`, "type"),
      );
    }
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
  let conceptRequest = supabase
    .from("my_concepts")
    .select("id, last_modified, content_of_concept(last_modified)")
    .eq("space_id", space.id);
  if (after) {
    const afterConceptResponse = await supabase
      .from("my_concepts")
      .select("source_local_id")
      .gt("last_modified", after.toISOString());
    if (afterConceptResponse.error) {
      return createApiResponse(request, afterConceptResponse);
    }
    const localIds = new Set<string>(
      afterConceptResponse.data
        .map((c) => c.source_local_id)
        .filter((s) => s !== null),
    );
    const afterContentResponse = await supabase
      .from("my_contents")
      .select("source_local_id")
      .gt("last_modified", after.toISOString());
    if (afterContentResponse.error) {
      return createApiResponse(request, afterContentResponse);
    }
    for (const s of afterConceptResponse.data) {
      if (s.source_local_id !== null) localIds.add(s.source_local_id);
    }
    conceptRequest = conceptRequest.in("source_local_id", [...localIds]);
  }

  const conceptResponse = await conceptRequest;
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
  const baseUrl = request.url.split("?")[0]!;
  const rootUrl = baseUrl.split("/").slice(0, 3).join("/");
  const ctxUrl = rootUrl + "/schema/context.jsonld";
  const localCtx: Record<string, string> = {
    sdata: baseUrl + "/",
  };
  const withMaxDate: Record<number, string> = {};
  concepts.map(({ id, last_modified, content_of_concept }) => {
    if (id === null || last_modified === null) return;
    if (
      content_of_concept &&
      content_of_concept.last_modified &&
      content_of_concept.last_modified > last_modified
    )
      last_modified = content_of_concept.last_modified;
    if (withMaxDate[id] === undefined || withMaxDate[id] < last_modified)
      withMaxDate[id] = last_modified;
  });

  const data = {
    "@context": [ctxUrl, localCtx],
    "@id": baseUrl,
    "@type": "Space",
    label: space.name,
    sameAs: space.url,
    container_of: Object.entries(withMaxDate).map(([id, lastModified]) => ({
      "@id": `sdata:${id}`,
      modified: lastModified + "Z",
    })),
  };
  return NextResponse.json(data, {
    status: 200,
    headers: { "Content-Type": "application/ld+json" },
  });
};

export const OPTIONS = defaultOptionsHandler;
