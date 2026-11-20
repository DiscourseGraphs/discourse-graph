import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  defaultOptionsHandler,
  createApiResponse,
} from "~/utils/supabase/apiUtils";
import {
  platformFromSegment,
  spaceDataUrl,
} from "~/utils/conversion/nodeAddress";
import { OWN_SPACE_PREFIX, wrapJsonLd } from "~/utils/conversion/jsonld";
import { findSpace } from "~/utils/conversion/nodeLookup";

export type SegmentDataType = { params: Promise<Record<string, string>> };

const findSpaceFromSegments = async (
  segmentData: SegmentDataType,
): ReturnType<typeof findSpace> => {
  const { platform, space_key } = await segmentData.params;
  const knownPlatform = platformFromSegment(platform ?? "");
  if (!knownPlatform || !space_key)
    return { failure: asPostgrestFailure("Space not found", "404", 404) };
  const supabase = await createClient();
  return findSpace({ supabase, platform: knownPlatform, spaceKey: space_key });
};

export const GET = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const afterParam = request.nextUrl.searchParams.get("after");
  let after: Date | undefined = undefined;
  if (afterParam) {
    after = new Date(afterParam);
    if (isNaN(after.getTime()))
      return createApiResponse(
        request,
        asPostgrestFailure(`after is not a date`, "type"),
      );
  }
  const spaceResult = await findSpaceFromSegments(segmentData);
  if ("failure" in spaceResult)
    return createApiResponse(request, spaceResult.failure);
  const { space } = spaceResult;
  const supabase = await createClient();
  let conceptRequest = supabase
    .from("my_concepts")
    .select(
      "id, source_local_id, last_modified, content_of_concept(last_modified)",
    )
    .eq("space_id", space.id);
  if (after) {
    const afterConceptResponse = await supabase
      .from("my_concepts")
      .select("source_local_id")
      .eq("space_id", space.id)
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
      .eq("space_id", space.id)
      .gt("last_modified", after.toISOString());
    if (afterContentResponse.error) {
      return createApiResponse(request, afterContentResponse);
    }
    for (const s of afterContentResponse.data) {
      if (s.source_local_id !== null) localIds.add(s.source_local_id);
    }
    conceptRequest = conceptRequest.in("source_local_id", [...localIds]);
  }

  const conceptResponse = await conceptRequest;
  if (conceptResponse.error) {
    return createApiResponse(request, conceptResponse);
  }
  const concepts = conceptResponse.data;
  const ownSpaceUrl = spaceDataUrl({
    origin: request.nextUrl.origin,
    platform: space.platform,
    spaceKey: spaceResult.spaceKey,
  });
  const localIdsById: Record<number, string> = {};
  const withMaxDate: Record<number, string> = {};
  // eslint-disable-next-line @typescript-eslint/naming-convention
  concepts.map(({ id, source_local_id, last_modified, content_of_concept }) => {
    if (id === null || last_modified === null || source_local_id === null)
      return;
    localIdsById[id] = source_local_id;
    if (
      content_of_concept &&
      content_of_concept.last_modified &&
      content_of_concept.last_modified > last_modified
    )
      last_modified = content_of_concept.last_modified;
    if (withMaxDate[id] === undefined || withMaxDate[id] < last_modified)
      withMaxDate[id] = last_modified;
  });

  const { "@context": context } = wrapJsonLd({ json: {}, ownSpaceUrl });
  const data = {
    "@context": context,
    "@id": ownSpaceUrl,
    "@type": "Container",
    label: space.name,
    sameAs: space.url,
    container_of: Object.entries(withMaxDate).map(([id, lastModified]) => ({
      "@id": `${OWN_SPACE_PREFIX}:${encodeURIComponent(localIdsById[Number(id)]!)}#it`,
      modified: lastModified + "Z",
    })),
  };
  return NextResponse.json(data, {
    status: 200,
    headers: { "Content-Type": "application/ld+json" },
  });
};

export const OPTIONS = defaultOptionsHandler;
