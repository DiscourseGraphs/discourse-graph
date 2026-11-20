import type { NextResponse, NextRequest } from "next/server";
import {
  defaultOptionsHandler,
  createApiResponse,
} from "~/utils/supabase/apiUtils";
import { nodePathFromSegments } from "~/utils/conversion/nodeLookup";
import { nodeDataResponse } from "~/api/data/nodeData";

export type SegmentDataType = { params: Promise<Record<string, string>> };

export const GET = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const { platform, space_key, local_id } = await segmentData.params;
  const nodePath = nodePathFromSegments({
    platform,
    spaceKey: space_key,
    localId: local_id,
  });
  if ("failure" in nodePath)
    return createApiResponse(request, nodePath.failure);
  return nodeDataResponse({ request, nodePath });
};

export const OPTIONS = defaultOptionsHandler;
