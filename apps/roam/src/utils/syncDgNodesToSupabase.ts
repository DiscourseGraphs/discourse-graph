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
const SYNC_INTERVAL = "45s";
const SYNC_TIMEOUT = "20s";
const BATCH_SIZE = 200;
const DEFAULT_TIME = new Date("1970-01-01");

type SyncTaskInfo = {
  lastUpdateTime?: Date;
  nextUpdateTime?: Date;
  spaceId: number;
  worker: string;
  shouldProceed: boolean;
};

export const endSyncTask = async (
  worker: string,
  status: Enums<"task_status">,
  showToast: boolean = false,
): Promise<boolean> => {
  try {
    const supabaseClient = await getLoggedInClient();
    if (!supabaseClient) return false;
    const context = await getSupabaseContext();
    if (!context) {
      console.error("endSyncTask: Unable to obtain Supabase context.");
      return false;
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
      return false;
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
    return false;
  }
  return true;
};

export const proposeSyncTask = async (): Promise<SyncTaskInfo> => {
  try {
    const supabaseClient = await getLoggedInClient();
    const context = supabaseClient ? await getSupabaseContext() : null;
    if (!context || !supabaseClient) {
      console.error("proposeSyncTask: Unable to obtain Supabase context.");
      return {
        spaceId: 0,
        worker: "",
        shouldProceed: false,
      };
    }
    const worker = window.roamAlphaAPI.user.uid();
    if (!worker) {
      console.error("proposeSyncTask: Unable to obtain user UID.");
      return {
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
      return { spaceId, worker, shouldProceed: false };
    }

    if (typeof data === "string") {
      const timestamp = new Date(data);
      const now = new Date();

      if (timestamp > now) {
        return {
          nextUpdateTime: timestamp,
          spaceId,
          worker,
          shouldProceed: false,
        };
      } else {
        return {
          lastUpdateTime: timestamp,
          spaceId,
          worker,
          shouldProceed: true,
        };
      }
    }

    return { spaceId, worker, shouldProceed: true };
  } catch (error) {
    console.error(
      `proposeSyncTask: Unexpected error while contacting sync-task API:`,
      error,
    );
    return {
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
}): Promise<boolean> => {
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

  const contentData: LocalContentDataInput[] =
    convertRoamNodeToLocalContent(result);
  const { error } = await supabaseClient.rpc("upsert_content", {
    data: contentData as Json,
    v_space_id: spaceId,
    v_creator_id: userId,
    content_as_document: true,
  });
  if (error) {
    console.error("upsert_content failed:", error);
    return false;
  }
  return true;
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
}): Promise<boolean> => {
  const nodeTypes = await nodeTypeSince(since, allNodeTypes);
  // TODO: partial upsert
  const success = await upsertNodeSchemaToContent({
    nodeTypesUids: nodeTypes.map((node) => node.type),
    spaceId: context.spaceId,
    userId: context.userId,
    supabaseClient,
  });
  if (!success) return false;
  // Short circuit here
  // TODO?: Look for which schemas already exist,
  // and we could then upsert concepts using those only...
  // But not sure it's worth it, because recovery would be hard.

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
    console.error(`upsert_concepts failed: ${JSON.stringify(error, null, 2)}`);
    return false;
  }
  return true;
};

const chunk = <T>(array: T[], size: number): T[][] => {
  if (array.length === 0) return [];
  if (size <= 2) throw new Error(`chunk size must be > 1 (got ${size})`);
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

const uploadNodesInBatches = async ({
  supabase,
  context,
  nodes,
  content_as_document,
}: {
  supabase: DGSupabaseClient;
  context: SupabaseContext;
  nodes: LocalContentDataInput[];
  content_as_document: boolean;
}): Promise<number> => {
  const v_space_id = context.spaceId;
  const v_creator_id = context.userId;
  const batches = chunk(nodes, BATCH_SIZE);
  let successes = 0;

  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];

    const { error } = await supabase.rpc("upsert_content", {
      data: batch as Json,
      v_space_id,
      v_creator_id,
      content_as_document,
    });

    if (error) {
      console.error(`upsert_content failed for batch ${idx + 1}:`, error);
      break;
    }
    successes += batch.length;
  }
  return successes;
};

export const addMissingEmbeddings = async (
  supabase: DGSupabaseClient,
  context: SupabaseContext,
): Promise<boolean | number> => {
  const response = await supabase
    .from("my_contents")
    .select(
      "id, text, emb:ContentEmbedding_openai_text_embedding_3_small_1536(target_id)",
    )
    .eq("space_id", context.spaceId)
    .is("emb", null)
    .not("text", "is", null);
  if (response.error) {
    console.error(response.error);
    return false;
  }
  if (response.data.length === 0) {
    console.debug("no embeddings");
    return true;
  }
  // Tell TS about the non-null values
  const data = response.data as (Omit<
    (typeof response.data)[number],
    "text" | "id"
  > & {
    text: string;
    id: number;
  })[];
  let successes = 0;
  const batches = chunk(data, BATCH_SIZE);
  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];
    try {
      const nodesWithEmbeddings = await fetchEmbeddingsForNodes(batch);
      const embeddings = nodesWithEmbeddings.map(
        ({ id, embedding_inline: { model, vector } }) => ({
          target_id: id,
          model,
          vector: JSON.stringify(vector),
        }),
      );
      const result = await supabase
        .from("ContentEmbedding_openai_text_embedding_3_small_1536")
        .upsert(embeddings, { onConflict: "target_id" })
        .select();
      if (result.error) {
        console.error(result.error);
        break;
      }
      successes += batch.length;
    } catch (e) {
      console.error(e);
      break;
    }
  }
  if (successes < data.length) {
    console.warn(
      `Tried sending content embeddings, ${successes}/${data.length} sent`,
    );
    // number indicates partial success
    return successes > 0 ? successes : false;
  }
  console.debug(`Done sending content embeddings`);
  return true;
};

export const upsertNodesToSupabaseAsContent = async (
  roamNodes: RoamDiscourseNodeData[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<boolean | number> => {
  if (roamNodes.length === 0) {
    return true;
  }
  const allNodeInstancesAsLocalContent =
    convertRoamNodeToLocalContent(roamNodes);

  const successes = await uploadNodesInBatches({
    supabase: supabaseClient,
    context,
    nodes: allNodeInstancesAsLocalContent,
    content_as_document: true,
  });
  if (successes < allNodeInstancesAsLocalContent.length) {
    console.warn(
      `Tried sending content, ${successes}/${allNodeInstancesAsLocalContent.length} sent`,
    );
    return successes > 0 ? successes : false;
  } else {
    console.debug(
      `Done sending ${allNodeInstancesAsLocalContent.length} contents`,
    );
  }
  return true;
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
): Promise<boolean> => {
  const { error } = await supabaseClient.rpc("upsert_accounts_in_space", {
    accounts: users,
    space_id_: context.spaceId,
  });
  if (error) {
    console.error("upsert_accounts_in_space failed:", error);
  }
  return error === null;
};

const BASE_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
let doSync = true;
let numFailures = 0;
const MAX_FAILURES = 5;
type TimeoutValue = ReturnType<typeof setTimeout>;
let activeTimeout: TimeoutValue | null = null;
// TODO: Maybe also pause sync while the window is not active?

class FatalError extends Error {}

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

export const createOrUpdateDiscourseEmbedding = async (
  showToast: boolean = false,
): Promise<void> => {
  if (!doSync) return;
  console.debug("starting createOrUpdateDiscourseEmbedding");
  let success = true;
  const { shouldProceed, lastUpdateTime, nextUpdateTime, worker } =
    await proposeSyncTask();

  try {
    if (!shouldProceed) {
      if (nextUpdateTime === undefined) {
        throw new Error("Can't obtain sync task");
      }
      console.debug("postponed to ", nextUpdateTime);
      if (doSync) {
        activeTimeout = setTimeout(
          createOrUpdateDiscourseEmbedding, // eslint-disable-line @typescript-eslint/no-misused-promises
          nextUpdateTime.valueOf() - Date.now() + 100,
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
    success &&= await upsertUsers(allUsers, supabaseClient, context);
    const partial: number | boolean = await upsertNodesToSupabaseAsContent(
      allNodeInstances,
      supabaseClient,
      context,
    );
    success &&= partial === true;
    // Count partial as failure, so we'll refetch from last success.
    // TODO?: Order nodes by modification time,
    // and set database last sync time according to partial failure
    if (partial !== false) {
      success &&= await convertDgToSupabaseConcepts({
        nodesSince:
          partial === true
            ? allNodeInstances
            : allNodeInstances.slice(0, partial),
        since: time,
        allNodeTypes: allDgNodeTypes,
        supabaseClient,
        context,
      });
    }
    // even if next two step fails, count as success, since they are not time-dependent
    await addMissingEmbeddings(supabaseClient, context);
    await cleanupOrphanedNodes(supabaseClient, context);
    // TODO: Add missing concepts, in case the concept upsert failed after the content upsert failed.
    // Requires checking ALL node Ids against all concept Ids, so definitely costly.
    // Another option: Find a way to identify whether content is a node,
    // so then we could just look for missing concepts, just as we do for embeddings
    await endSyncTask(worker, "complete", showToast);
  } catch (error) {
    console.error("createOrUpdateDiscourseEmbedding: Process failed:", error);
    await endSyncTask(worker, "failed", showToast);
    success = false;
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
    timeout *= 2 ** numFailures;
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
  if (supabase === null) return;
  const result = await supabase
    .from("Space")
    .select()
    .eq("url", getRoamUrl())
    .maybeSingle();
  if (!result.data) {
    doSync = false;
  } else {
    doSync = true;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    activeTimeout = setTimeout(createOrUpdateDiscourseEmbedding, 100, true);
  }
};
