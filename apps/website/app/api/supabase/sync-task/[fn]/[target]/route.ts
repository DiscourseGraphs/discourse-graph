import { NextResponse, NextRequest } from "next/server";
import type { PostgrestSingleResponse } from "@supabase/supabase-js";
import { createClient } from "~/utils/supabase/server";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import {
  createApiResponse,
  handleRouteError,
  defaultOptionsHandler,
} from "~/utils/supabase/apiUtils";

type SyncTaskInfo = {
  worker: string;
  timeout?: string;
  task_interval?: string;
};

const SYNC_DEFAULTS: Partial<SyncTaskInfo> = {
  timeout: "20s",
  task_interval: "45s",
};

type ApiParams = Promise<{ target: string; fn: string }>;
export type SegmentDataType = { params: ApiParams };

// POST with the SyncTaskInfo to the /supabase/sync-task/{function_name}/{target} endpoint
export const POST = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  try {
    const { target, fn } = await segmentData.params;
    const targetN = Number.parseInt(target);
    if (isNaN(targetN)) {
      return createApiResponse(
        request,
        asPostgrestFailure(`${target} is not a number`, "type"),
      );
    }
    const info: SyncTaskInfo = { ...SYNC_DEFAULTS, ...(await request.json()) };
    if (!info.worker) {
      return createApiResponse(
        request,
        asPostgrestFailure("Worker field is required", "invalid"),
      );
    }
    const supabase = await createClient();
    const response = (await supabase.rpc("propose_sync_task", {
      s_target: targetN,
      s_function: fn,
      s_worker: info.worker,
      timeout: info.timeout,
      task_interval: info.task_interval,
    })) as PostgrestSingleResponse<Date | null | boolean>;
    if (response.data === null) {
      // NextJS responses cannot handle null values, convert to boolean success indicator
      response.data = true;
    }

    return createApiResponse(request, response);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/route");
  }
};

// GET the sync_info table from /supabase/sync-task/{function_name}/{target} (should not be necessary)
export const GET = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  const { target, fn } = await segmentData.params;
  const targetN = Number.parseInt(target);
  if (isNaN(targetN)) {
    return createApiResponse(
      request,
      asPostgrestFailure(`${targetN} is not a number`, "type"),
    );
  }
  const supabase = await createClient();
  const response = await supabase
    .from("sync_info")
    .select()
    .eq("sync_target", targetN)
    .eq("sync_function", fn)
    .maybeSingle();
  return createApiResponse(request, response);
};

export const OPTIONS = defaultOptionsHandler;
