import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  defaultOptionsHandler,
  createApiResponse,
} from "~/utils/supabase/apiUtils";
import { asJsonLD, wrapJsonLd } from "~/utils/conversion/jsonld";
import { Tables } from "@repo/database/dbTypes";
import { PostgrestMaybeSingleResponse } from "@supabase/supabase-js";

type Concept = Tables<"Concept">;
type Content = Tables<"Content">;
type Space = Tables<"Space">;
type PlatformAccount = Tables<"PlatformAccount">;

export type SegmentDataType = { params: Promise<Record<string, string>> };

export const GET = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const { space_id, resource_id } = await segmentData.params;
  const targetFormat = request.nextUrl.searchParams.get("format") ?? "html";
  const withContext = request.nextUrl.searchParams.get("context");
  const withSchema = request.nextUrl.searchParams.get("schema");
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
  const space: Space = spaceResponse.data;
  const conceptResponse = await supabase
    .from("Concept")
    .select()
    .eq("id", resourceIdN)
    .maybeSingle();
  if (conceptResponse.error) {
    return createApiResponse(request, conceptResponse);
  }
  const concept = conceptResponse.data;
  if (!concept) {
    return createApiResponse(
      request,
      asPostgrestFailure("Resource not found", "401", 401),
    );
  }
  const contentResponse = await supabase
    .from("Content")
    .select()
    .eq("source_local_id", concept.source_local_id!);
  if (contentResponse.error) {
    return createApiResponse(request, conceptResponse);
  }
  const contents: Content[] = contentResponse.data;
  const fullContentsArray = contents.filter((c) => c.variant === "full");
  const fullContents = fullContentsArray.length
    ? fullContentsArray[0]
    : undefined;
  const titleArray = contents.filter((c) => c.variant === "direct");
  const title = titleArray.length ? titleArray[0] : undefined;

  const requestUrlParts = request.url.split("/");
  const baseUrl = requestUrlParts
    .slice(0, requestUrlParts.length - 1)
    .join("/");
  const rootUrl = baseUrl.split("/").slice(0, 3).join("/");
  const pageUrl = `${rootUrl}/api/content/${baseUrl.split("/")[5]}/${concept.id}#`;
  let schemas: Record<number, Concept> = {};
  let authors: Record<number, PlatformAccount> = {};
  let relations: Concept[] = [];
  let schemaIds = new Set<number>();
  if (withContext) {
    const relationsResult = (await supabase
      .from("Concept")
      .select("relations:concept_in_relations!inner(*)")
      .eq("id", concept.id)
      .maybeSingle()) as PostgrestMaybeSingleResponse<{ relations: Concept[] }>;
    if (relationsResult.data?.relations?.length) {
      relations = relationsResult.data.relations;
      if (withSchema)
        schemaIds = new Set(
          relations.map((c) => c.schema_id).filter((id) => id !== null),
        );
    }
  }
  if (concept.schema_id) schemaIds.add(concept.schema_id);
  if (schemaIds.size > 0) {
    const schemaResponse = await supabase
      .from("Concept")
      .select()
      .in("id", [...schemaIds]);
    if (schemaResponse.error) {
      return createApiResponse(request, schemaResponse);
    }
    if (!schemaResponse.data) {
      return createApiResponse(
        request,
        asPostgrestFailure("Resource schema not found", "401", 401),
      );
    }
    schemas = Object.fromEntries(schemaResponse.data.map((s) => [s.id, s]));
  }
  const authorIds = new Set<number>([
    concept.author_id!,
    ...relations.map((r) => r.author_id).filter((id) => id !== null),
    ...Object.values(schemas)
      .map((s) => s.author_id)
      .filter((id) => id !== null),
  ]);
  if (authorIds.size > 0) {
    const authorsResponse = await supabase
      .from("PlatformAccount")
      .select()
      .in("id", [...authorIds]);
    if (authorsResponse.error) {
      return createApiResponse(request, authorsResponse);
    }
    if (!authorsResponse.data) {
      return createApiResponse(
        request,
        asPostgrestFailure("Resource schema not found", "401", 401),
      );
    }
    authors = Object.fromEntries(authorsResponse.data.map((a) => [a.id, a]));
  }

  const relationsJLD = withContext
    ? await Promise.all(
        relations.map((c) =>
          asJsonLD({
            space,
            concept: c,
            baseUrl,
            schema: c.schema_id ? schemas[c.schema_id] : undefined,
            author: c.author_id ? authors[c.author_id] : undefined,
          }),
        ),
      )
    : [];
  const schemasJLD = withSchema
    ? await Promise.all(
        Object.values(schemas).map((c) =>
          asJsonLD({
            space,
            concept: c,
            baseUrl,
            author: c.author_id ? authors[c.author_id] : undefined,
          }),
        ),
      )
    : [];

  const baseJLDData = await asJsonLD({
    space,
    concept,
    baseUrl,
    title,
    schema: concept.schema_id ? schemas[concept.schema_id] : undefined,
    content: targetFormat === "none" ? undefined : fullContents,
    author: concept.author_id ? authors[concept.author_id] : undefined,
    targetFormat,
  });

  const jsonLdData =
    relationsJLD.length > 0 || schemasJLD.length > 0
      ? [baseJLDData, ...relationsJLD, ...schemasJLD]
      : baseJLDData;
  return NextResponse.json(wrapJsonLd(jsonLdData, baseUrl, pageUrl), {
    status: 200,
    headers: { "Content-Type": "application/ld+json" },
  });
};

export const OPTIONS = defaultOptionsHandler;
