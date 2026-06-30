import { NextResponse, NextRequest } from "next/server";
import { type Database, Constants } from "@repo/database/dbTypes";
import { asPostgrestFailure } from "@repo/database/lib/contextFunctions";
import { createClient } from "~/utils/supabase/server";
import { createApiResponse, handleRouteError } from "~/utils/supabase/apiUtils";

type ApiParams = Promise<{ target: string; fn: string; worker: string }>;
export type SegmentDataType = { params: ApiParams };

type TaskStatus = Database["public"]["Enums"]["task_status"];

type ParsedEndSyncTaskBody =
  | {
      ok: true;
      status: TaskStatus;
      startedAt?: string;
    }
  | {
      ok: false;
      error: string;
    };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeStartedAt = (value: unknown): string | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.valueOf()) ? null : date.toISOString();
  }

  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return value;
  }

  return null;
};

const parseEndSyncTaskBody = (body: unknown): ParsedEndSyncTaskBody => {
  if (typeof body === "string") {
    if (
      (Constants.public.Enums.task_status as readonly string[]).includes(body)
    ) {
      return {
        ok: true,
        status: body as TaskStatus,
      };
    }

    return {
      ok: false,
      error: `${body} is not a task status`,
    };
  }

  if (!isRecord(body)) {
    return {
      ok: false,
      error:
        "Request body must be a task status string or " +
        "{ status: string, s_started_at: string | number }",
    };
  }

  const { status, s_started_at: startedAtRaw } = body;
  if (
    typeof status !== "string" ||
    !(Constants.public.Enums.task_status as readonly string[]).includes(status)
  ) {
    return {
      ok: false,
      error: `${String(status)} is not a task status`,
    };
  }

  const startedAt = normalizeStartedAt(startedAtRaw);
  if (startedAt === null) {
    return {
      ok: false,
      error: "s_started_at must be an ISO timestamp string or epoch number",
    };
  }

  return {
    ok: true,
    status: status as TaskStatus,
    startedAt,
  };
};

// POST the task status and claim timestamp to the /supabase/sync-task/{function_name}/{target}/{worker} endpoint
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
    const infoRaw: unknown = await request.json();
    const parsedBody = parseEndSyncTaskBody(infoRaw);
    if (!parsedBody.ok) {
      return createApiResponse(
        request,
        asPostgrestFailure(parsedBody.error, "type"),
      );
    }
    const supabase = await createClient();
    const rpcArgs: Database["public"]["Functions"]["end_sync_task"]["Args"] = {
      s_target: targetN,
      s_function: fn,
      s_worker: worker,
      s_status: parsedBody.status,
    };
    if (parsedBody.startedAt !== undefined) {
      rpcArgs.s_started_at = parsedBody.startedAt;
    }

    const response = await supabase.rpc("end_sync_task", rpcArgs);
    if (response.status === 204) {
      response.data = { ok: true, stale: false };
      response.status = 200;
    }

    return createApiResponse(request, response);
  } catch (e: unknown) {
    return handleRouteError(request, e, "/api/supabase/sync-task");
  }
};
