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
import { type OnloadArgs } from "roamjs-components/types";
import { fetchEmbeddingsForNodes } from "./upsertNodesAsContentWithEmbeddings";
import { convertRoamNodeToLocalContent } from "./upsertNodesAsContentWithEmbeddings";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Json, CompositeTypes } from "@repo/database/dbTypes";

type LocalContentDataInput = Partial<CompositeTypes<"content_local_input">>;
type AccountLocalInput = CompositeTypes<"account_local_input">;

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
    }
  } catch (error) {
    console.error("endSyncTask: Error calling end_sync_task:", error);
  }
};

export const proposeSyncTask = async (): Promise<SyncTaskInfo> => {
  try {
    const supabaseClient = await getLoggedInClient();
    const context = await getSupabaseContext();
    if (!context) {
      console.error("proposeSyncTask: Unable to obtain Supabase context.");
      return {
        lastUpdateTime: null,
        spaceId: 0,
        worker: "",
        shouldProceed: false,
      };
    }
    const worker = window.roamAlphaAPI.user.uid();
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
        console.log(
          "proposeSyncTask: Another worker is already running this task",
        );
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
    return;
  }

  if (nodesWithEmbeddings.length !== allNodeInstancesAsLocalContent.length) {
    console.error(
      "upsertNodesToSupabaseAsContentWithEmbeddings: Mismatch between node and embedding counts.",
    );
    return;
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
        console.error(`upsert_content failed for batch ${idx + 1}:`, error);
        throw error;
      }
    }
  };

  await uploadBatches(chunk(nodesWithEmbeddings, BATCH_SIZE));
};

const getDgNodeTypes = (extensionAPI: OnloadArgs["extensionAPI"]) => {
  const allDgNodeTypes = getDiscourseNodes().filter(
    (n) => n.backedBy === "user",
  );
  const dgNodeTypesWithSettings = allDgNodeTypes.filter((n) => {
    const settingsKey = `discourse-graph-node-rule-${n.type}`;
    const settings = extensionAPI.settings.get(settingsKey) as
      | {
          isFirstChild?: boolean;
          embeddingRef?: string;
        }
      | undefined;
    return settings?.isFirstChild || settings?.embeddingRef;
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
  }
};

export const createOrUpdateDiscourseEmbedding = async (
  extensionAPI: OnloadArgs["extensionAPI"],
) => {
  const { shouldProceed, lastUpdateTime, worker } = await proposeSyncTask();

  if (!shouldProceed) {
    console.log(
      "createOrUpdateDiscourseEmbedding: Task already running or failed to acquire lock. Exiting.",
    );
    return;
  }

  try {
    const allUsers = await getAllUsers();
    const time = lastUpdateTime === null ? DEFAULT_TIME : lastUpdateTime;
    const { allDgNodeTypes, dgNodeTypesWithSettings } =
      getDgNodeTypes(extensionAPI);

    const allNodeInstances = await getAllDiscourseNodesSince(
      time,
      dgNodeTypesWithSettings,
      extensionAPI,
    );
    const supabaseClient = await getLoggedInClient();
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
