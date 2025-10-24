/* eslint-disable @typescript-eslint/naming-convention */
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
import { getRoamUrl } from "roamjs-components/dom";
import { render as renderToast } from "roamjs-components/components/Toast";
import { createClient, type DGSupabaseClient } from "@repo/database/lib/client";
import type { Json, CompositeTypes, Enums } from "@repo/database/dbTypes";

type LocalContentDataInput = Partial<CompositeTypes<"content_local_input">>;
type AccountLocalInput = CompositeTypes<"account_local_input">;

const SYNC_FUNCTION = "embedding";
// Minimal interval between syncs of all clients for this task.
const SYNC_INTERVAL = "45s";
// Interval between syncs for each client individually
const BASE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SYNC_TIMEOUT = "20s";
const BATCH_SIZE = 200;
const DEFAULT_TIME = new Date("1970-01-01");

class FatalError extends Error {}

type SyncTaskInfo = {
  lastUpdateTime?: Date;
  nextUpdateTime?: Date;
  shouldProceed: boolean;
};

export const endSyncTask = async (
  worker: string,
  status: Enums<"task_status">,
  showToast: boolean = false,
): Promise<void> => {
  try {
    const supabaseClient = await getLoggedInClient();
    if (!supabaseClient) return;
    const context = await getSupabaseContext();
    if (!context) {
      console.error("endSyncTask: Unable to obtain Supabase context.");
      return;
    }
    const { error } = await supabaseClient.rpc("end_sync_task", {
      s_target: context.spaceId,
      s_function: SYNC_FUNCTION,
      s_worker: worker,
      s_status: status,
    });
    if (error) {
      console.error("endSyncTask: Error calling end_sync_task:", error);
      if (showToast)
        renderToast({
          id: "discourse-embedding-error",
          content: "Failed to complete discourse node embeddings sync",
          intent: "danger",
          timeout: 5000,
        });
      return;
    } else if (showToast) {
      if (status === "complete") {
        renderToast({
          id: "discourse-embedding-complete",
          content: "Successfully completed discourse node embeddings sync",
          intent: "success",
          timeout: 4000,
        });
      } else if (status === "failed") {
        renderToast({
          id: "discourse-embedding-failed",
          content: "Discourse node embeddings sync failed",
          intent: "danger",
          timeout: 5000,
        });
      }
    }
  } catch (error) {
    console.error("endSyncTask: Error calling end_sync_task:", error);
    if (showToast)
      renderToast({
        id: "discourse-embedding-error",
        content: "Failed to complete discourse node embeddings sync",
        intent: "danger",
        timeout: 5000,
      });
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
        `proposeSyncTask: propose_sync_task failed – ${error.message}`,
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
  const result = (await window.roamAlphaAPI.data.async.q(
    query,
    nodeTypesUids,
  )) as unknown as RoamDiscourseNodeData[];

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
  since: string;
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
  const { ordered } = orderConceptsByDependency(conceptsToUpsert);
  const { error } = await supabaseClient.rpc("upsert_concepts", {
    data: ordered,
    v_space_id: context.spaceId,
  });
  if (error) {
    throw new Error(
      `upsert_concepts failed: ${JSON.stringify(error, null, 2)}`,
    );
  }
};

export const upsertNodesToSupabaseAsContentWithEmbeddings = async (
  roamNodes: RoamDiscourseNodeData[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<void> => {
  const { userId } = context;

  if (roamNodes.length === 0) {
    return;
  }
  const allNodeInstancesAsLocalContent = convertRoamNodeToLocalContent({
    nodes: roamNodes,
  });

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

  const chunk = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  const uploadBatches = async (batches: LocalContentDataInput[][]) => {
    for (let idx = 0; idx < batches.length; idx++) {
      const batch = batches[idx];

      const { error } = await supabaseClient.rpc("upsert_content", {
        data: batch as Json,
        v_space_id: context.spaceId,
        v_creator_id: userId,
        content_as_document: true,
      });

      if (error) {
        throw new Error(`upsert_content failed for batch ${idx + 1}:`, error);
      }
    }
  };

  await uploadBatches(chunk(nodesWithEmbeddings, BATCH_SIZE));
};

const getDgNodeTypes = () => {
  const allDgNodeTypes = getDiscourseNodes().filter(
    (n) => n.backedBy === "user",
  );
  const dgNodeTypesWithSettings = allDgNodeTypes.filter((n) => {
    return n.isFirstChild?.value || n.embeddingRef !== undefined;
  });
  return { allDgNodeTypes, dgNodeTypesWithSettings };
};

const getAllUsers = async (): Promise<AccountLocalInput[]> => {
  const query = `[:find ?author_local_id ?author_name
  :keys author_local_id name
  :where
    [?user-eid :user/uid ?author_local_id]
    [(get-else $ ?user-eid :user/display-name "") ?author_name]
]`;
  //@ts-ignore - backend to be added to roamjs-components
  const result = (await window.roamAlphaAPI.data.async.q(query)) as unknown as {
    author_local_id: string;
    name: string;
  }[];
  return result.map((user) => ({
    account_local_id: user.author_local_id,
    name: user.name,
    email: null,
    email_trusted: null,
    space_editor: null,
  }));
};

const upsertUsers = async (
  users: AccountLocalInput[],
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

export const createOrUpdateDiscourseEmbedding = async (showToast = false) => {
  if (!doSync) return;
  console.debug("starting createOrUpdateDiscourseEmbedding");
  let success = true;
  let claimed = false;
  const worker = window.roamAlphaAPI.user.uid();

  try {
    if (!worker) {
      throw new FatalError("Unable to obtain user UID.");
    }
    if (!createClient()) {
      // not worth retrying
      // TODO: Differentiate setup vs connetion error
      throw new FatalError("Could not access supabase.");
    }
    const supabaseClient = await getLoggedInClient();
    if (!supabaseClient) {
      // TODO: Distinguish connection vs credentials error
      throw new Error("Could not log in to client.");
    }
    const context = await getSupabaseContext();
    if (!context) {
      // not worth retrying: setup error
      throw new FatalError("Error connecting to client.");
    }
    const { shouldProceed, lastUpdateTime, nextUpdateTime } =
      await proposeSyncTask(worker, supabaseClient, context);
    if (!shouldProceed) {
      if (nextUpdateTime === undefined) {
        throw new Error("Can't obtain sync task");
      }
      claimed = true;
      console.debug("postponed to ", nextUpdateTime);
      if (doSync) {
        activeTimeout = setTimeout(
          createOrUpdateDiscourseEmbedding, // eslint-disable-line @typescript-eslint/no-misused-promises
          Math.max(0, nextUpdateTime.valueOf() - Date.now()) + 100,
        );
      }
      return;
    }
    const allUsers = await getAllUsers();
    const time = (lastUpdateTime || DEFAULT_TIME).toISOString();
    const { allDgNodeTypes, dgNodeTypesWithSettings } = getDgNodeTypes();

    const allNodeInstances = await getAllDiscourseNodesSince(
      time,
      dgNodeTypesWithSettings,
    );
    await upsertUsers(allUsers, supabaseClient, context);
    await upsertNodesToSupabaseAsContentWithEmbeddings(
      allNodeInstances,
      supabaseClient,
      context,
    );
    await convertDgToSupabaseConcepts({
      nodesSince: allNodeInstances,
      since: time,
      allNodeTypes: allDgNodeTypes,
      supabaseClient,
      context,
    });
    await cleanupOrphanedNodes(supabaseClient, context);
    await endSyncTask(worker, "complete", showToast);
  } catch (error) {
    console.error("createOrUpdateDiscourseEmbedding: Process failed:", error);
    success = false;
    if (worker && claimed) await endSyncTask(worker, "failed", showToast);
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
    const jitter = 0.9 + Math.random() * 0.2; // 0.9x–1.1x
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

export const initializeSupabaseSync = async () => {
  const supabase = createClient();
  if (supabase === null) {
    doSync = false;
  } else {
    doSync = true;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    activeTimeout = setTimeout(createOrUpdateDiscourseEmbedding, 100, true);
  }
};
