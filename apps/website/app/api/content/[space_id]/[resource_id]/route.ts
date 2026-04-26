import { NextResponse, NextRequest } from "next/server";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  defaultOptionsHandler,
  createApiResponse,
} from "~/utils/supabase/apiUtils";
import { asJsonLD } from "~/utils/conversion/jsonld";
import { Tables } from "@repo/database/dbTypes";
import { convert, initRT, MIMETYPES } from "~/utils/conversion/relationaltext";

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
  const targetMimetype = MIMETYPES[targetFormat];
  if (!targetMimetype) {
    return createApiResponse(
      request,
      asPostgrestFailure("Unsupported format", "404", 404),
    );
  }
  const includeData =
    targetFormat === "html" &&
    request.nextUrl.searchParams.get("data") !== "false";
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
  const requestUrlParts = request.url.split("/");
  const baseUrl = requestUrlParts
    .slice(0, requestUrlParts.length - 1)
    .join("/");
  const fullContentsArray = contents.filter((c) => c.variant === "full");
  const fullContents = fullContentsArray.length
    ? fullContentsArray[0]
    : undefined;
  const titleArray = contents.filter((c) => c.variant === "direct");
  const title = titleArray.length ? titleArray[0] : undefined;

  if (!fullContents) {
    return createApiResponse(
      request,
      asPostgrestFailure("Resource not found", "401", 401),
    );
  }

  const rootUrl = baseUrl.split("/").slice(0, 3).join("/");
  await initRT(rootUrl);
  const source: string | undefined =
    space.platform === "Obsidian"
      ? "obsidian"
      : space.platform === "Roam"
        ? "roam"
        : undefined;
  let text =
    source && source !== targetFormat
      ? await convert(fullContents.text, source, targetFormat)
      : fullContents.text;
  if (includeData) {
    const isSchema = concept.is_schema;
    let schema: Concept | undefined = undefined;
    if (!isSchema && concept.schema_id) {
      const schemaResponse = await supabase
        .from("Concept")
        .select()
        .eq("id", concept.schema_id)
        .maybeSingle();
      if (schemaResponse.error) {
        return createApiResponse(request, schemaResponse);
      }
      if (!schemaResponse.data) {
        return createApiResponse(
          request,
          asPostgrestFailure("Resource schema not found", "401", 401),
        );
      }
      schema = schemaResponse.data;
    }

    const authorId = concept.author_id ?? (contents ?? [{}])[0]?.author_id;
    let author: PlatformAccount | undefined = undefined;
    if (authorId) {
      const authorResponse = await supabase
        .from("PlatformAccount")
        .select()
        .eq("id", authorId)
        .maybeSingle();
      if (authorResponse.data) author = authorResponse.data;
    }

    const jsonLdData = await asJsonLD({
      space,
      concept,
      baseUrl,
      title,
      schema,
      content: undefined,
      author,
      targetFormat,
    });
    const insertionPoint = text.indexOf(">");
    if (insertionPoint > 0) {
      text =
        text.slice(0, insertionPoint + 1) +
        `<script type="application/ld+json">${JSON.stringify(jsonLdData)}</script>` +
        text.slice(insertionPoint + 1);
    }
  }

  return new NextResponse(text, {
    headers: { "Content-Type": targetMimetype },
  });
};

export const OPTIONS = defaultOptionsHandler;
