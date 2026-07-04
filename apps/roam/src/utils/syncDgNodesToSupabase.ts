import posthog from "posthog-js";
import {
  getAllDiscourseNodesSince,
  nodeTypeSince,
} from "./getAllDiscourseNodesSince";
import { cleanupOrphanedNodes } from "./cleanupOrphanedNodes";
import {
  getLoggedInClient,
  getSupabaseContext,
  type SupabaseContext,
} from "./supabaseContext";
import { type RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import {
  discourseNodeBlockToLocalConcept,
  discourseNodeSchemaToLocalConcept,
  orderConceptsByDependency,
} from "./conceptConversion";
import { fetchEmbeddingsForNodes } from "./upsertNodesAsContentWithEmbeddings";
import { convertRoamNodeToLocalContent } from "./upsertNodesAsContentWithEmbeddings";
import { convertRoamNodeToFullContent } from "./convertRoamNodeToFullContent";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { intersection } from "@repo/utils/setOperations";
import type { Json, Enums } from "@repo/database/dbTypes";
import { render as renderToast } from "roamjs-components/components/Toast";
import internalError from "~/utils/internalError";
import { FatalError } from "@repo/database/lib/contextFunctions";
import { getAllPages } from "@repo/database/lib/pagination";
import type {
  LocalConceptDataInput,
  LocalContentDataInput,
  LocalAccountDataInput,
} from "@repo/database/inputTypes";
import type { Properties } from "posthog-js";

const SYNC_FUNCTION = "embedding";
// Minimal interval between syncs of all clients for this task.
const SYNC_INTERVAL = "130s";
// Interval between syncs for each client individually
const BASE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_TIMEOUT = "60s"; // must be less than half the SYNC_INTERVAL.
const BATCH_SIZE = 200;
const CONCEPT_BATCH_SIZE = 200;
const END_SYNC_TASK_RESULT_VERSION = 1;

type SyncPhaseDurations = Record<string, number>;

type SyncTaskInfo = {
  lastUpdateTime?: Date;
  nextUpdateTime?: Date;
  shouldProceed: boolean;
};

type EndSyncTaskRpcResult = {
  version?: number;
  ok: boolean;
  stale: boolean;
  reason?: string;
  requestedStatus?: string;
  callerWorker?: string;
  currentWorker?: string;
  currentStatus?: string;
  callerStartedAt?: string;
  currentStartedAt?: string;
  lastTaskEnd?: string;
  lastSuccessStart?: string;
  taskTimesOutAt?: string;
  failureCount?: number;
};

type EndSyncTaskResult =
  | {
      ok: true;
      stale: false;
      rpcResult?: EndSyncTaskRpcResult;
    }
  | {
      ok: false;
      stale: true;
      rpcResult?: EndSyncTaskRpcResult;
    }
  | {
      ok: false;
      stale: false;
      error: Error;
      rpcResult?: EndSyncTaskRpcResult;
    };

let syncWorkerId: string | null = null;

const createRuntimeId = (): string => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function")
    return crypto.randomUUID();

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getSyncWorkerId = (): string => {
  if (syncWorkerId === null) {
    syncWorkerId = `roam-${createRuntimeId()}`;
  }

  return syncWorkerId;
};

const getJsonObject = (
  data: Json | undefined,
): Record<string, unknown> | null => {
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return null;
  }

  return data as Record<string, unknown>;
};

const getEndSyncTaskResultVersion = (data: Json | undefined): number => {
  const result = getJsonObject(data);
  if (result === null || typeof result.version !== "number") {
    return 0;
  }

  return result.version;
};

const isEndSyncTaskRpcResult = (
  data: Json | undefined,
): data is EndSyncTaskRpcResult => {
  const result = getJsonObject(data);
  if (result === null) return false;

  const versionIsSupported =
    result.version === undefined || typeof result.version === "number";

  return (
    versionIsSupported &&
    typeof result.ok === "boolean" &&
    typeof result.stale === "boolean"
  );
};

const measureSyncPhase = async <T>({
  phase,
  phases,
  operation,
}: {
  phase: string;
  phases: SyncPhaseDurations;
  operation: () => Promise<T>;
}): Promise<T> => {
  const phaseStart = performance.now();
  try {
    return await operation();
  } finally {
    phases[phase] = Math.round(performance.now() - phaseStart);
  }
};

const syncTelemetryContext = ({
  attemptId,
  worker,
  userUid,
  context,
  startTime,
  claimed,
  phases,
  status,
  reason,
  nextUpdateTime,
  lastUpdateTime,
  endSyncResult,
}: {
  attemptId: string;
  worker: string;
  userUid: string;
  context: SupabaseContext | null;
  startTime: Date;
  claimed: boolean;
  phases: SyncPhaseDurations;
  status: string;
  reason?: string;
  nextUpdateTime?: Date;
  lastUpdateTime?: Date;
  endSyncResult?: EndSyncTaskRpcResult;
}): Properties => {
  const duration = (Date.now() - startTime.valueOf()) / 1000.0;
  const phaseProperties = Object.fromEntries(
    Object.entries(phases).map(([phase, durationMs]) => [
      `phase_${phase}_ms`,
      durationMs,
    ]),
  );

  return {
    syncAttemptId: attemptId,
    syncWorkerId: worker,
    syncFunction: SYNC_FUNCTION,
    syncUserUid: userUid,
    claimed,
    status,
    duration,
    reason,
    spaceId: context?.spaceId,
    startedAt: startTime.toISOString(),
    nextUpdateTime: nextUpdateTime?.toISOString(),
    lastUpdateTime: lastUpdateTime?.toISOString(),
    endSyncResult,
    ...phaseProperties,
  };
};

const chunk = <T>(array: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const summarizeFailedConceptUpsertIds = (failedIds: number[]): string => {
  const counts = failedIds.reduce<Record<string, number>>((acc, id) => {
    acc[id] = (acc[id] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(counts)
    .map(([id, count]) => `${id}: ${count}`)
    .join(", ");
};

const upsertConceptBatches = async ({
  concepts,
  supabaseClient,
  spaceId,
}: {
  concepts: LocalConceptDataInput[];
  supabaseClient: DGSupabaseClient;
  spaceId: number;
}): Promise<void> => {
  const batches = chunk(concepts, CONCEPT_BATCH_SIZE);

  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];

    const { data, error } = await supabaseClient.rpc("upsert_concepts", {
      data: batch as Json,
      v_space_id: spaceId,
    });

    if (error) {
      throw new Error(
        `upsert_concepts failed for batch ${idx + 1}/${batches.length}: ${JSON.stringify(error, null, 2)}`,
      );
    }

    const failedIds = (data || []).filter((id) => id < 0);
    if (failedIds.length > 0) {
      throw new Error(
        `upsert_concepts returned row failures for batch ${idx + 1}/${batches.length}: ${summarizeFailedConceptUpsertIds(failedIds)}`,
      );
    }
  }
};

const notifyEndSyncFailure = ({
  status,
  showToast,
  reason,
  context,
}: {
  status: Enums<"task_status">;
  showToast: boolean;
  reason: string;
  context?: Properties;
}): void => {
  if (showToast) {
    renderToast({
      id: "discourse-embedding-error",
      content: "Failed to complete discourse node embeddings sync",
      intent: "danger",
      timeout: 5000,
    });
  }

  internalError({
    error: new Error(reason),
    type: "Sync Failed",
    context: { status, ...(context || {}) },
  });
};

export const endSyncTask = async ({
  worker,
  status,
  showToast = false,
  taskStartedAt,
  context,
  supabaseClient,
  telemetryContext,
}: {
  worker: string;
  status: Enums<"task_status">;
  showToast: boolean;
  taskStartedAt: Date;
  context?: SupabaseContext;
  supabaseClient?: DGSupabaseClient;
  telemetryContext?: Properties;
}): Promise<EndSyncTaskResult> => {
  try {
    const resolvedClient = supabaseClient || (await getLoggedInClient());
    if (!resolvedClient) {
      const error = new Error("Missing Supabase client while ending sync task");
      return { ok: false, stale: false, error };
    }
    const resolvedContext = context || (await getSupabaseContext());
    if (!resolvedContext) {
      console.error("endSyncTask: Unable to obtain Supabase context.");
      const error = new Error("Unable to obtain Supabase context");
      return { ok: false, stale: false, error };
    }
    const { data, error } = await resolvedClient.rpc("end_sync_task", {
      s_target: resolvedContext.spaceId,
      s_function: SYNC_FUNCTION,
      s_worker: worker,
      s_status: status,
      s_started_at: taskStartedAt.toISOString(),
    });
    if (error) {
      console.error("endSyncTask: Error calling end_sync_task:", error);
      const reason = `Supabase end_sync_task RPC failed: ${error.message ?? "Unknown error"}`;
      notifyEndSyncFailure({
        status,
        showToast,
        reason,
        context: {
          ...telemetryContext,
          endSyncErrorCode: error.code,
          endSyncErrorDetails: error.details,
          endSyncErrorHint: error.hint,
        },
      });

      return {
        ok: false,
        stale: false,
        error: new Error(reason),
      };
    }

    if (!isEndSyncTaskRpcResult(data)) {
      const resultVersion = getEndSyncTaskResultVersion(data);
      if (resultVersion > END_SYNC_TASK_RESULT_VERSION) {
        const rpcResult: EndSyncTaskRpcResult = {
          version: resultVersion,
          ok: true,
          stale: false,
          reason: "unsupported_future_result_version",
        };
        posthog.capture("Sync end task future result", {
          ...telemetryContext,
          endSyncPayload: data,
          endSyncResult: rpcResult,
        });

        return {
          ok: true,
          stale: false,
          rpcResult,
        };
      }

      const reason = "Supabase end_sync_task returned unexpected payload";
      notifyEndSyncFailure({
        status,
        showToast,
        reason,
        context: {
          ...telemetryContext,
          endSyncPayload: data,
        },
      });

      return {
        ok: false,
        stale: false,
        error: new Error(reason),
      };
    }

    const rpcResult = data;
    if (rpcResult?.stale === true) {
      posthog.capture("Sync end task stale", {
        ...telemetryContext,
        endSyncResult: rpcResult,
      });

      return {
        ok: false,
        stale: true,
        rpcResult,
      };
    }

    if (rpcResult?.ok === false) {
      const reason =
        rpcResult.reason || "Supabase end_sync_task returned failure";
      notifyEndSyncFailure({
        status,
        showToast,
        reason,
        context: {
          ...telemetryContext,
          endSyncResult: rpcResult,
        },
      });

      return {
        ok: false,
        stale: false,
        error: new Error(reason),
        rpcResult,
      };
    }

    if (showToast) {
      if (status === "failed") {
        renderToast({
          id: "discourse-embedding-failed",
          content: "Discourse node embeddings sync failed",
          intent: "danger",
          timeout: 5000,
        });
      }
    }

    return { ok: true, stale: false, rpcResult };
  } catch (error) {
    console.error("endSyncTask: Error calling end_sync_task:", error);
    const reason =
      error instanceof Error
        ? `Unexpected error ending sync task: ${error.message}`
        : "Unexpected non-error thrown while ending sync task";
    notifyEndSyncFailure({
      status,
      showToast,
      reason,
      context: telemetryContext,
    });

    return {
      ok: false,
      stale: false,
      error: error instanceof Error ? error : new Error(reason),
    };
  }
};

export const proposeSyncTask = async (
  worker: string,
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<SyncTaskInfo> => {
  try {
    const now = new Date();
    const { data, error } = await supabaseClient.rpc("propose_sync_task", {
      s_target: context.spaceId,
      s_function: SYNC_FUNCTION,
      s_worker: worker,
      task_interval: SYNC_INTERVAL,
      timeout: SYNC_TIMEOUT,
    });

    if (error) {
      console.error(
        `proposeSyncTask: propose_sync_task failed - ${error.message}`,
      );
      return { shouldProceed: false };
    }

    if (typeof data === "string") {
      const timestamp = new Date(data);

      if (timestamp > now) {
        return {
          nextUpdateTime: timestamp,
          shouldProceed: false,
        };
      } else {
        return {
          lastUpdateTime: timestamp,
          shouldProceed: true,
        };
      }
    }

    return { shouldProceed: true };
  } catch (error) {
    console.error(
      `proposeSyncTask: Unexpected error while contacting sync-task API:`,
      error,
    );
    return {
      shouldProceed: false,
    };
  }
};

const upsertNodeSchemaToContent = async ({
  nodeTypesUids,
  spaceId,
  userId,
  supabaseClient,
}: {
  nodeTypesUids: string[];
  spaceId: number;
  userId: number;
  supabaseClient: DGSupabaseClient;
}) => {
  const query = `[
    :find     ?uid    ?create-time    ?edit-time    ?user-uuid    ?title ?author-name
    :keys     source_local_id    created    last_modified    author_local_id    text author_name
    :in       $  [?uid ...]
    :where
      [?e :block/uid       ?uid]
      [?e :node/title      ?title]
      [?e :create/user     ?user-eid]
      [?user-eid :user/uid ?user-uuid]
      [?e :create/time     ?create-time]
      [?e :edit/time       ?edit-time]
      [?e :edit/user       ?eu]
      [(get-else $ ?eu :user/display-name "Unknown-person") ?author-name]

  ]
  `;

  const result = (await window.roamAlphaAPI.data.backend.q(
    query,
    nodeTypesUids,
  )) as unknown[] as RoamDiscourseNodeData[];

  const contentData: LocalContentDataInput[] = convertRoamNodeToLocalContent({
    nodes: result,
  });
  const { error } = await supabaseClient.rpc("upsert_content", {
    data: contentData as Json,
    v_space_id: spaceId,
    v_creator_id: userId,
    content_as_document: true,
  });
  if (error) {
    console.error("upsert_content failed:", error);
    throw new Error(error.message);
  }
};

export const convertDgToSupabaseConcepts = async ({
  nodesSince,
  since,
  allNodeTypes,
  supabaseClient,
  context,
}: {
  nodesSince: RoamDiscourseNodeData[];
  since: number | undefined;
  allNodeTypes: DiscourseNode[];
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
}) => {
  const nodeTypes = await nodeTypeSince(since, allNodeTypes);
  await upsertNodeSchemaToContent({
    nodeTypesUids: nodeTypes.map((node) => node.type),
    spaceId: context.spaceId,
    userId: context.userId,
    supabaseClient,
  });

  const nodesTypesToLocalConcepts = nodeTypes.map((node) => {
    return discourseNodeSchemaToLocalConcept(context, node);
  });

  const nodeBlockToLocalConcepts = nodesSince.map((node) => {
    const localConcept = discourseNodeBlockToLocalConcept(context, {
      nodeUid: node.source_local_id,
      schemaUid: node.type,
      text: node.node_title ? `${node.node_title} ${node.text}` : node.text,
    });
    return localConcept;
  });

  const conceptsToUpsert = [
    ...nodesTypesToLocalConcepts,
    ...nodeBlockToLocalConcepts,
  ];
  const { ordered, missing } = orderConceptsByDependency(conceptsToUpsert);

  if (missing.length > 0) {
    console.warn(
      "Some concept dependencies were not in the current sync batch:",
      missing,
    );
  }

  await upsertConceptBatches({
    concepts: ordered,
    supabaseClient,
    spaceId: context.spaceId,
  });
};

export const upsertNodesToSupabaseAsContentWithEmbeddings = async (
  roamNodes: RoamDiscourseNodeData[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
  options: { includeFullContent?: boolean } = {},
): Promise<void> => {
  const { userId } = context;
  const { includeFullContent = false } = options;

  if (roamNodes.length === 0) {
    return;
  }
  const allNodeInstancesAsLocalContent = convertRoamNodeToLocalContent({
    nodes: roamNodes,
  });

  const uploadBatches = async (
    batches: LocalContentDataInput[][],
  ): Promise<void> => {
    for (let idx = 0; idx < batches.length; idx++) {
      const batch = batches[idx];

      const { error } = await supabaseClient.rpc("upsert_content", {
        data: batch as Json,
        v_space_id: context.spaceId,
        v_creator_id: userId,
        content_as_document: true,
      });

      if (error) {
        throw new Error(`upsert_content failed for batch ${idx + 1}`, {
          cause: error,
        });
      }
    }
  };

  if (includeFullContent) {
    const fullContent = convertRoamNodeToFullContent({
      nodes: roamNodes,
    });
    await uploadBatches(chunk(fullContent, BATCH_SIZE));
  }

  let nodesWithEmbeddings: LocalContentDataInput[];
  try {
    nodesWithEmbeddings = await fetchEmbeddingsForNodes(
      allNodeInstancesAsLocalContent,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `upsertNodesToSupabaseAsContentWithEmbeddings: Embedding service failed – ${message}`,
    );
    throw new Error(message);
  }

  if (nodesWithEmbeddings.length !== allNodeInstancesAsLocalContent.length) {
    console.error(
      "upsertNodesToSupabaseAsContentWithEmbeddings: Mismatch between node and embedding counts.",
    );
    throw new Error(
      "upsertNodesToSupabaseAsContentWithEmbeddings: Mismatch between node and embedding counts.",
    );
  }

  await uploadBatches(chunk(nodesWithEmbeddings, BATCH_SIZE));
};

const getAllUsers = async (): Promise<LocalAccountDataInput[]> => {
  const query = `[:find ?author_local_id ?author_name
  :keys author_local_id name
  :where
    [?user-eid :user/uid ?author_local_id]
    [(get-else $ ?user-eid :user/display-name "") ?author_name]
]`;
  const result = (await window.roamAlphaAPI.data.backend.q(
    query,
  )) as unknown[] as {
    author_local_id: string;
    name: string;
  }[];
  return result.map((user) => ({
    account_local_id: user.author_local_id,
    name: user.name,
    email: null,
    email_trusted: null,
    space_editor: null,
    permissions: null,
  }));
};

const upsertUsers = async (
  users: LocalAccountDataInput[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
) => {
  const { error } = await supabaseClient.rpc("upsert_accounts_in_space", {
    accounts: users,
    space_id_: context.spaceId,
  });
  if (error) {
    console.error("upsert_accounts_in_space failed:", error);
    throw error;
  }
};

let doSync = true;
let initialSync = true;
let numFailures = 0;
const MAX_FAILURES = 5;
type TimeoutValue = ReturnType<typeof setTimeout>;
let activeTimeout: TimeoutValue | null = null;
// TODO: Maybe also pause sync while the window is not active?

export const setSyncActivity = (active: boolean) => {
  doSync = active;
  if (!active && activeTimeout !== null) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  } else if (active && activeTimeout === null) {
    activeTimeout = setTimeout(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      createOrUpdateDiscourseEmbedding,
      100,
    );
  }
};

const getAllMissingOrNewDiscourseNodes = async ({
  supabaseClient,
  spaceId,
  since,
  nodeTypes,
}: {
  supabaseClient: DGSupabaseClient;
  spaceId: number;
  since: number | undefined;
  nodeTypes: DiscourseNode[];
}): Promise<RoamDiscourseNodeData[]> => {
  const allNodes = await getAllDiscourseNodesSince(undefined, nodeTypes);
  if (since === undefined) return allNodes;
  const newNodes = await getAllDiscourseNodesSince(since, nodeTypes);
  const existingContentIdsReq = await getAllPages(
    supabaseClient
      .from("my_contents")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .order("id"),
    1000,
  );
  if (!Array.isArray(existingContentIdsReq)) throw existingContentIdsReq;
  const existingConceptIdsReq = await getAllPages(
    supabaseClient
      .from("my_concepts")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .eq("arity", 0)
      .eq("is_schema", false)
      .order("id"),
    1000,
  );
  if (!Array.isArray(existingConceptIdsReq)) throw existingConceptIdsReq;
  const existingIds = new Set([
    ...intersection(
      new Set(existingConceptIdsReq.map((d) => d.source_local_id)),
      new Set(existingContentIdsReq.map((d) => d.source_local_id)),
    ),
    ...newNodes.map((n) => n.source_local_id),
  ]);
  return [
    ...newNodes,
    ...allNodes.filter((n) => !existingIds.has(n.source_local_id)),
  ];
};

export const createOrUpdateDiscourseEmbedding = async (
  showToast = false,
): Promise<void> => {
  if (!doSync) return;
  console.debug("starting createOrUpdateDiscourseEmbedding");
  const startTime = new Date();
  const attemptId = createRuntimeId();
  const phases: SyncPhaseDurations = {};
  let success = true;
  let claimed = false;
  const isInitialSync = initialSync; // record state at start
  let claimedAt: Date | null = null;
  let context: SupabaseContext | null = null;
  let supabaseClient: DGSupabaseClient | null = null;
  let userUid = "";
  const worker = getSyncWorkerId();

  const buildTelemetry = ({
    status,
    reason,
    nextUpdateTime,
    lastUpdateTime,
    endSyncResult,
  }: {
    status: string;
    reason?: string;
    nextUpdateTime?: Date;
    lastUpdateTime?: Date;
    endSyncResult?: EndSyncTaskRpcResult;
  }): Properties =>
    syncTelemetryContext({
      attemptId,
      worker,
      userUid,
      context,
      startTime,
      claimed,
      phases,
      status,
      reason,
      nextUpdateTime,
      lastUpdateTime,
      endSyncResult,
    });

  try {
    const resolvedUserUid = window.roamAlphaAPI.user.uid();
    if (!resolvedUserUid) {
      throw new FatalError("Unable to obtain user UID.");
    }
    userUid = resolvedUserUid;

    supabaseClient = await measureSyncPhase({
      phase: "getLoggedInClient",
      phases,
      operation: getLoggedInClient,
    });
    if (!supabaseClient) {
      // TODO: Distinguish connection vs credentials error
      throw new Error("Could not log in to client.");
    }
    context = await measureSyncPhase({
      phase: "getSupabaseContext",
      phases,
      operation: getSupabaseContext,
    });
    if (!context) {
      // not worth retrying: setup error
      throw new FatalError("Error connecting to client.");
    }
    const activeSupabaseClient = supabaseClient;
    const activeContext = context;
    const { shouldProceed, lastUpdateTime, nextUpdateTime } =
      await measureSyncPhase({
        phase: "proposeSyncTask",
        phases,
        operation: () =>
          proposeSyncTask(worker, activeSupabaseClient, activeContext),
      });
    if (!shouldProceed) {
      if (nextUpdateTime === undefined) {
        throw new Error("Can't obtain sync task");
      }
      console.debug("postponed to ", nextUpdateTime);
      posthog.capture(
        "Sync postponed",
        buildTelemetry({
          status: "postponed",
          nextUpdateTime,
          lastUpdateTime,
        }),
      );
      if (doSync) {
        activeTimeout = setTimeout(
          createOrUpdateDiscourseEmbedding, // eslint-disable-line @typescript-eslint/no-misused-promises
          Math.max(0, nextUpdateTime.valueOf() - Date.now()) +
            100 +
            Math.floor(Math.random() * 200), // avoid stampede
        );
      }
      return;
    }
    claimed = true;
    const activeClaimedAt = new Date();
    claimedAt = activeClaimedAt;
    const allUsers = await measureSyncPhase({
      phase: "getAllUsers",
      phases,
      operation: getAllUsers,
    });
    const sinceTime = lastUpdateTime
      ? lastUpdateTime.valueOf() - 1000 // add a one-second buffer
      : undefined;
    const allDgNodeTypes = getDiscourseNodes().filter(
      (n) => n.backedBy === "user",
    );

    const allNodeInstances = await measureSyncPhase({
      phase: isInitialSync
        ? "getAllMissingOrNewDiscourseNodes"
        : "getAllDiscourseNodesSince",
      phases,
      operation: () =>
        isInitialSync
          ? getAllMissingOrNewDiscourseNodes({
              supabaseClient: activeSupabaseClient,
              spaceId: activeContext.spaceId,
              since: sinceTime,
              nodeTypes: allDgNodeTypes,
            })
          : getAllDiscourseNodesSince(sinceTime, allDgNodeTypes),
    });
    await measureSyncPhase({
      phase: "upsertUsers",
      phases,
      operation: () =>
        upsertUsers(allUsers, activeSupabaseClient, activeContext),
    });
    await measureSyncPhase({
      phase: "upsertNodes",
      phases,
      operation: () =>
        upsertNodesToSupabaseAsContentWithEmbeddings(
          allNodeInstances,
          activeSupabaseClient,
          activeContext,
        ),
    });
    await measureSyncPhase({
      phase: "convertConcepts",
      phases,
      operation: () =>
        convertDgToSupabaseConcepts({
          nodesSince: allNodeInstances,
          since: sinceTime,
          allNodeTypes: allDgNodeTypes,
          supabaseClient: activeSupabaseClient,
          context: activeContext,
        }),
    });
    await measureSyncPhase({
      phase: "cleanupOrphanedNodes",
      phases,
      operation: () =>
        cleanupOrphanedNodes(activeSupabaseClient, activeContext),
    });
    const completeEndResult = await measureSyncPhase({
      phase: "endSyncTask",
      phases,
      operation: () =>
        endSyncTask({
          worker,
          status: "complete",
          showToast,
          taskStartedAt: activeClaimedAt,
          context: activeContext,
          supabaseClient: activeSupabaseClient,
          telemetryContext: buildTelemetry({
            status: "complete",
            lastUpdateTime,
          }),
        }),
    });

    if (completeEndResult.ok) {
      initialSync = false;
      posthog.capture(
        "Sync complete",
        buildTelemetry({
          status: "complete",
          lastUpdateTime,
          endSyncResult: completeEndResult.rpcResult,
        }),
      );
    } else if (completeEndResult.stale) {
      posthog.capture(
        "Sync stale",
        buildTelemetry({
          status: "stale",
          reason:
            completeEndResult.rpcResult?.reason ||
            "end_sync_task completed by newer sync task",
          lastUpdateTime,
          endSyncResult: completeEndResult.rpcResult,
        }),
      );
    } else {
      posthog.capture(
        "Sync error",
        buildTelemetry({
          status: "end_task_failed",
          reason: completeEndResult.error.message,
          lastUpdateTime,
          endSyncResult: completeEndResult.rpcResult,
        }),
      );
    }
  } catch (error) {
    console.error("createOrUpdateDiscourseEmbedding: Process failed:", error);
    success = false;
    const reason =
      error instanceof Error ? error.message : "Unknown sync error";
    let failedEndResult: EndSyncTaskResult | undefined;
    const failedClaimedAt = claimedAt;
    if (failedClaimedAt !== null) {
      failedEndResult = await measureSyncPhase({
        phase: "endSyncTaskFailed",
        phases,
        operation: () =>
          endSyncTask({
            worker,
            status: "failed",
            showToast,
            taskStartedAt: failedClaimedAt,
            context: context || undefined,
            supabaseClient: supabaseClient || undefined,
            telemetryContext: buildTelemetry({ status: "failed", reason }),
          }),
      });
    }
    posthog.capture(
      "Sync error",
      buildTelemetry({
        status: error instanceof FatalError ? "fatal" : "failed",
        reason,
        endSyncResult: failedEndResult?.rpcResult,
      }),
    );
    if (error instanceof FatalError) {
      doSync = false;
      return;
    }
  }
  let timeout = BASE_SYNC_INTERVAL;
  if (success) {
    numFailures = 0;
  } else {
    numFailures += 1;
    if (numFailures >= MAX_FAILURES) {
      doSync = false;
      return;
    }
    const jitter = 0.9 + Math.random() * 0.2; // 0.9x-1.1x
    timeout *= 2 ** numFailures * jitter;
  }
  if (activeTimeout != null) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }
  if (doSync) {
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    activeTimeout = setTimeout(createOrUpdateDiscourseEmbedding, timeout);
  }
};

export const initializeSupabaseSync = (): void => {
  if (activeTimeout !== null) {
    clearTimeout(activeTimeout);
    activeTimeout = null;
  }

  doSync = true;
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  activeTimeout = setTimeout(createOrUpdateDiscourseEmbedding, 100, true);
};
