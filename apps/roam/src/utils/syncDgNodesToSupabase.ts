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
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Json, CompositeTypes } from "@repo/database/dbTypes";

type LocalContentDataInput = Partial<CompositeTypes<"content_local_input">>;
type AccountLocalInput = CompositeTypes<"account_local_input">;
const { createClient } = require("@repo/database/lib/client");

const SYNC_FUNCTION = "embedding";
const SYNC_INTERVAL = "45s";
const SYNC_TIMEOUT = "20s";
const BATCH_SIZE = 200;
const DEFAULT_TIME = "1970-01-01";

type SyncTaskInfo = {
  lastUpdateTime: string | null;
  spaceId: number;
  worker: string;
  shouldProceed: boolean;
};

export const endSyncTask = async (
  worker: string,
  status: "complete" | "failed",
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
      renderToast({
        id: "discourse-embedding-error",
        content: "Failed to complete discourse node embeddings sync",
        intent: "danger",
        timeout: 5000,
      });
    } else {
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
    renderToast({
      id: "discourse-embedding-error",
      content: "Failed to complete discourse node embeddings sync",
      intent: "danger",
      timeout: 5000,
    });
  }
};

export const proposeSyncTask = async (): Promise<SyncTaskInfo> => {
  try {
    const supabaseClient = await getLoggedInClient();
    const context = supabaseClient ? await getSupabaseContext() : null;
    console.log("proposeSyncTask: Context", context);
    if (!context || !supabaseClient) {
      console.error("proposeSyncTask: Unable to obtain Supabase context.");
      return {
        lastUpdateTime: null,
        spaceId: 0,
        worker: "",
        shouldProceed: false,
      };
    }
    const worker = window.roamAlphaAPI.user.uid();
    console.log("proposeSyncTask: Worker", worker);
    if (!worker) {
      console.error("proposeSyncTask: Unable to obtain user UID.");
      return {
        lastUpdateTime: null,
        spaceId: 0,
        worker: "",
        shouldProceed: false,
      };
    }

    const { data, error } = await supabaseClient.rpc("propose_sync_task", {
      s_target: context.spaceId,
      s_function: SYNC_FUNCTION,
      s_worker: worker,
      task_interval: SYNC_INTERVAL,
      timeout: SYNC_TIMEOUT,
    });
    console.log("proposeSyncTask: Data", data);
    console.log("proposeSyncTask: Error", error);
    const { spaceId } = context;

    if (error) {
      console.error(
        `proposeSyncTask: propose_sync_task failed – ${error.message}`,
      );
      return { lastUpdateTime: null, spaceId, worker, shouldProceed: false };
    }

    if (typeof data === "string") {
      const timestamp = new Date(data);
      const now = new Date();

      if (timestamp > now) {
        return { lastUpdateTime: null, spaceId, worker, shouldProceed: false };
      } else {
        return { lastUpdateTime: data, spaceId, worker, shouldProceed: true };
      }
    }

    return { lastUpdateTime: null, spaceId, worker, shouldProceed: true };
  } catch (error) {
    console.error(
      `proposeSyncTask: Unexpected error while contacting sync-task API:`,
      error,
    );
    return {
      lastUpdateTime: null,
      spaceId: 0,
      worker: "",
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
  //@ts-ignore - backend to be added to roamjs-components
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

export const createOrUpdateDiscourseEmbedding = async () => {
  const { shouldProceed, lastUpdateTime, worker } = await proposeSyncTask();

  if (!shouldProceed) {
    return;
  }

  try {
    const allUsers = await getAllUsers();
    const time = lastUpdateTime === null ? DEFAULT_TIME : lastUpdateTime;
    const { allDgNodeTypes, dgNodeTypesWithSettings } = getDgNodeTypes();

    console.log(
      "createOrUpdateDiscourseEmbedding: Getting all discourse nodes since",
      time,
    );

    const allNodeInstances = await getAllDiscourseNodesSince(
      time,
      dgNodeTypesWithSettings,
    );

    console.log(
      "createOrUpdateDiscourseEmbedding: All discourse nodes since",
      allNodeInstances,
    );
    console.log(
      "createOrUpdateDiscourseEmbedding: All discourse nodes since",
      time,
      allNodeInstances.length,
    );

    const supabaseClient = await getLoggedInClient();
    if (!supabaseClient) return null;
    const context = await getSupabaseContext();
    if (!context) {
      console.error("No Supabase context found.");
      await endSyncTask(worker, "failed");
      return;
    }
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
    await endSyncTask(worker, "complete");
  } catch (error) {
    console.error("createOrUpdateDiscourseEmbedding: Process failed:", error);
    await endSyncTask(worker, "failed");
    throw error;
  }
};

export const initializeSupabaseSync = async () => {
  const supabase = createClient();
  if (supabase === null) return;
  const result = await supabase
    .from("Space")
    .select()
    .eq("url", getRoamUrl())
    .maybeSingle();
  if (!result.data) {
    return;
  } else {
    createOrUpdateDiscourseEmbedding();
  }
};
