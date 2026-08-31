import { NextRequest, NextResponse } from "next/server";

import { isSupportedContentType } from "@repo/content-model";
import type {
  ContentRepresentation,
  ContentResolveRequest,
  ResolvedContent,
} from "@repo/database/contentApi";
import type { Enums } from "@repo/database/dbTypes";
import {
  defaultOptionsHandler,
  handleRouteError,
} from "~/utils/supabase/apiUtils";
import { createRequestSupabaseClient } from "~/utils/supabase/request";
import cors from "~/utils/llm/cors";

type SegmentData = { params: Promise<{ id: string }> };

const CONTENT_VARIANTS = new Set<Enums<"ContentVariant">>([
  "direct",
  "direct_and_children",
  "direct_and_description",
  "full",
]);
const MAX_SOURCE_LOCAL_IDS = 500;

const isRepresentation = (value: unknown): value is ContentRepresentation => {
  if (typeof value !== "object" || value === null) return false;
  const representation = value as Record<string, unknown>;
  return (
    typeof representation.variant === "string" &&
    CONTENT_VARIANTS.has(representation.variant as Enums<"ContentVariant">) &&
    typeof representation.contentType === "string" &&
    isSupportedContentType(representation.contentType)
  );
};

const isContentResolveRequest = (
  value: unknown,
): value is ContentResolveRequest => {
  if (typeof value !== "object" || value === null) return false;
  const request = value as Record<string, unknown>;
  return (
    Array.isArray(request.sourceLocalIds) &&
    request.sourceLocalIds.length <= MAX_SOURCE_LOCAL_IDS &&
    request.sourceLocalIds.every(
      (sourceLocalId) =>
        typeof sourceLocalId === "string" && sourceLocalId.trim() !== "",
    ) &&
    Array.isArray(request.representations) &&
    request.representations.length > 0 &&
    request.representations.every(isRepresentation)
  );
};

const jsonWithCors = <T>({
  request,
  body,
  status = 200,
}: {
  request: NextRequest;
  body: T;
  status?: number;
}): NextResponse =>
  cors(request, NextResponse.json(body, { status })) as NextResponse;

const getRepresentationKey = ({
  variant,
  contentType,
}: ContentRepresentation): string => `${variant}\u0000${contentType}`;

export const POST = async (
  request: NextRequest,
  { params }: SegmentData,
): Promise<NextResponse> => {
  try {
    const { id } = await params;
    const spaceId = Number.parseInt(id, 10);
    if (!Number.isSafeInteger(spaceId) || spaceId <= 0) {
      return jsonWithCors({
        request,
        body: { error: "Space id must be a positive integer." },
        status: 400,
      });
    }

    const body: unknown = await request.json();
    if (!isContentResolveRequest(body)) {
      return jsonWithCors({
        request,
        body: { error: "Invalid content resolve request." },
        status: 400,
      });
    }
    const sourceLocalIds = [...new Set(body.sourceLocalIds)];
    if (sourceLocalIds.length === 0) {
      return jsonWithCors<ResolvedContent[]>({ request, body: [] });
    }

    const supabase = createRequestSupabaseClient({ request });
    const { data, error, status } = await supabase
      .from("my_contents")
      .select(
        "source_local_id, variant, content_type, text, metadata, created, last_modified, author_id",
      )
      .eq("space_id", spaceId)
      .in("source_local_id", sourceLocalIds);
    if (error !== null) {
      return jsonWithCors({
        request,
        body: { error: error.message, details: error.details || undefined },
        status,
      });
    }

    const requestedRepresentations = new Set(
      body.representations.map(getRepresentationKey),
    );
    const resolved: ResolvedContent[] = (data ?? []).flatMap((row) => {
      if (
        row.source_local_id === null ||
        row.variant === null ||
        row.content_type === null ||
        !isSupportedContentType(row.content_type) ||
        !requestedRepresentations.has(
          getRepresentationKey({
            variant: row.variant,
            contentType: row.content_type,
          }),
        )
      ) {
        return [];
      }
      return [
        {
          sourceLocalId: row.source_local_id,
          variant: row.variant,
          contentType: row.content_type,
          text: row.text,
          metadata: row.metadata,
          created: row.created,
          lastModified: row.last_modified,
          authorId: row.author_id,
        },
      ];
    });
    return jsonWithCors({ request, body: resolved });
  } catch (error) {
    return handleRouteError(
      request,
      error,
      "/api/internal/space/[id]/content/resolve",
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
