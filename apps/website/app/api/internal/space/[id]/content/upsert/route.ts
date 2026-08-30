import { NextRequest, NextResponse } from "next/server";

import type {
  ContentUpsertRequest,
  ContentUpsertResponse,
} from "@repo/database/contentApi";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  defaultOptionsHandler,
  handleRouteError,
} from "~/utils/supabase/apiUtils";
import { createRequestSupabaseClient } from "~/utils/supabase/request";
import cors from "~/utils/llm/cors";

type SegmentData = { params: Promise<{ id: string }> };

const MAX_CONTENT_ROWS = 500;

const isContentUpsertRequest = (
  value: unknown,
): value is ContentUpsertRequest => {
  if (typeof value !== "object" || value === null) return false;
  const request = value as Record<string, unknown>;
  return (
    Array.isArray(request.content) &&
    request.content.length > 0 &&
    request.content.length <= MAX_CONTENT_ROWS &&
    request.content.every(
      (row) =>
        typeof row === "object" &&
        row !== null &&
        typeof (row as Record<string, unknown>).source_local_id === "string",
    ) &&
    (request.contentAsDocument === undefined ||
      typeof request.contentAsDocument === "boolean")
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

const getCreatorId = async ({
  supabase,
  spaceId,
}: {
  supabase: DGSupabaseClient;
  spaceId: number;
}): Promise<number> => {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError !== null || authData.user === null) {
    throw new Error(authError?.message ?? "Authentication is required.");
  }

  const { data: accounts, error: accountsError } = await supabase
    .from("PlatformAccount")
    .select("id")
    .eq("dg_account", authData.user.id);
  if (accountsError !== null) throw accountsError;
  const accountIds = (accounts ?? []).map(({ id }) => id);
  if (accountIds.length === 0) {
    throw new Error("The authenticated user has no platform account.");
  }

  const { data: localAccess, error: localAccessError } = await supabase
    .from("LocalAccess")
    .select("account_id")
    .eq("space_id", spaceId)
    .in("account_id", accountIds)
    .limit(1)
    .maybeSingle();
  if (localAccessError !== null) throw localAccessError;
  if (localAccess === null) {
    throw new Error("The authenticated user cannot write to this space.");
  }
  return localAccess.account_id;
};

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
    if (!isContentUpsertRequest(body)) {
      return jsonWithCors({
        request,
        body: { error: "Invalid content upsert request." },
        status: 400,
      });
    }

    const supabase = createRequestSupabaseClient({ request });
    const creatorId = await getCreatorId({ supabase, spaceId });
    const { data, error, status } = await supabase.rpc("upsert_content", {
      data: body.content,
      v_space_id: spaceId,
      v_creator_id: creatorId,
      content_as_document: body.contentAsDocument ?? true,
    });
    if (error !== null) {
      return jsonWithCors({
        request,
        body: { error: error.message, details: error.details || undefined },
        status,
      });
    }
    return jsonWithCors<ContentUpsertResponse>({
      request,
      body: { ids: data },
    });
  } catch (error) {
    return handleRouteError(
      request,
      error,
      "/api/internal/space/[id]/content/upsert",
    );
  }
};

export const OPTIONS = defaultOptionsHandler;
