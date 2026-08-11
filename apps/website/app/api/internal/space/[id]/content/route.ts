import { NextResponse, NextRequest } from "next/server";

import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import type { Json } from "@repo/database/dbTypes";
import { StandaloneCrossAppContent } from "@repo/database/crossAppContracts";
import { crossAppStandaloneContentToDbContent } from "@repo/database/lib/crossAppConverters";
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

  try {
    const userId = await getAccountId(supabase);
    if (userId === undefined)
      return createApiResponse(
        request,
        asPostgrestFailure("Please login", "invalid", 401),
      );
    const body = (await request.json()) as StandaloneCrossAppContent[];
    // TODO: Zed validator
    const content = body
      .map((c) =>
        crossAppStandaloneContentToDbContent(
          {
            ...c,
            createdAt: new Date(c.createdAt),
            modifiedAt: new Date(c.modifiedAt || c.createdAt),
          },
          spaceId,
        ),
      )
      .filter((c) => c !== undefined);
    if (content.length === 0) throw new Error("Could not translate content");
    const result = await supabase.rpc("upsert_content", {
      data: content as Json,
      v_space_id: spaceId,
      v_creator_id: userId,
      content_as_document: true,
    });
    return createApiResponse(request, result);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/space/[id]/content");
  }
};

export const OPTIONS = defaultOptionsHandler;
