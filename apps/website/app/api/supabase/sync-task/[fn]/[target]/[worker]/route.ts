import { NextResponse, NextRequest } from "next/server";
import { PostgrestSingleResponse } from "@supabase/supabase-js";
import { Database, Constants } from "@repo/database/types.gen.ts";
import { createClient } from "~/utils/supabase/server";
import {
  createApiResponse,
  asPostgrestFailure,
  handleRouteError,
} from "~/utils/supabase/apiUtils";

type ApiParams = Promise<{ target: string; fn: string; worker: string }>;
export type SegmentDataType = { params: ApiParams };

// POST the task status to the /supabase/sync-task/{function_name}/{target}/{worker} endpoint
export const POST = async (
  request: NextRequest,
  segmentData: SegmentDataType,
): Promise<NextResponse> => {
  try {
    const { target, fn, worker } = await segmentData.params;
    const targetN = Number.parseInt(target);
    if (isNaN(targetN)) {
      return createApiResponse(
        request,
        asPostgrestFailure(`${target} is not a number`, "type"),
      );
    }
    const infoS: string = await request.json();
    if (
      !(Constants.public.Enums.task_status as readonly string[]).includes(infoS)
    ) {
      return createApiResponse(
        request,
        asPostgrestFailure(`${infoS} is not a task status`, "type"),
      );
    }
    const info = infoS as Database["public"]["Enums"]["task_status"];
    const supabase = await createClient();
    const response = (await supabase.rpc("end_sync_task", {
      s_target: targetN,
      s_function: fn,
      s_worker: worker,
      s_status: info,
    })) as PostgrestSingleResponse<boolean>;
    // Transform 204 No Content to 200 OK with success indicator for API consistency
    if (response.status === 204) {
      response.data = true;
      response.status = 200;
    }

    return createApiResponse(request, response);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/sync-task");
  }
};
