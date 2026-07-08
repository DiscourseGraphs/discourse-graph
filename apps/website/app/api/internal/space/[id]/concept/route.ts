import { NextResponse, NextRequest } from "next/server";

import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import type { Json } from "@repo/database/dbTypes";
import { CrossAppNode } from "@repo/database/crossAppContracts";
import { crossAppNodeToDbConcept } from "@repo/database/lib/crossAppConverters";
import { getAccountId } from "~/utils/supabase/account";

type ApiParams = Promise<{ id: string }>;
export type SegmentDataType = { params: ApiParams };

export const POST = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const { id: spaceIdS } = await segmentData.params;
  const spaceId = Number.parseInt(spaceIdS);
  if (Number.isNaN(spaceId))
    return createApiResponse(
      request,
      asPostgrestFailure("Cannot parse space id", "invalid", 403),
    );

  const supabase = await createClient();

  const userId = await getAccountId(supabase);
  if (userId === undefined)
    return createApiResponse(
      request,
      asPostgrestFailure("Please login", "invalid", 401),
    );
  try {
    const body = (await request.json()) as CrossAppNode[];
    // TODO: Zed validator
    const concepts = body
      .map((c) => crossAppNodeToDbConcept(c))
      .filter((c) => c !== undefined);
    if (concepts.length === 0) throw new Error("Could not translate concepts");
    const result = await supabase.rpc("upsert_concepts", {
      data: concepts as Json,
      v_space_id: spaceId,
      v_creator_id: userId,
      content_as_document: true,
    });
    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/space/[id]/concept");
  }
};

export const OPTIONS = defaultOptionsHandler;
