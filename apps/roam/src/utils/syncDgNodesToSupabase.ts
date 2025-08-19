/* eslint-disable @typescript-eslint/naming-convention */
import {
  getAllDiscourseNodesSince,
  nodeTypeSince,
} from "./getAllDiscourseNodesSince";
import { cleanupOrphanedNodes } from "./cleanupOrphanedNodes";
import {
  getLoggedInClient,
  getSupabaseContext,
  SupabaseContext,
} from "./supabaseContext";
import { fetchEmbeddingsForNodes } from "./fetchEmbeddingsForNodes";
import { LocalContentDataInput } from "@repo/database/inputTypes";
import { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import getDiscourseRelations from "./getDiscourseRelations";
import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";
import {
  discourseNodeBlockToLocalConcept,
  discourseNodeSchemaToLocalConcept,
  orderConceptsByDependency,
  discourseRelationSchemaToLocalConcept,
  discourseRelationDataToLocalConcept,
} from "./conceptConversion";
import getDiscourseRelationTriples from "./getDiscourseRelationTriples";
import { OnloadArgs } from "roamjs-components/types";
import { DGSupabaseClient } from "@repo/ui/lib/supabase/client";

const SYNC_FUNCTION = "embedding";
const SYNC_INTERVAL = "45s";
const SYNC_TIMEOUT = "20s";
const BATCH_SIZE = 200;
const DEFAULT_TIME = "1970-01-01";
const EMBEDDING_MODEL = "openai_text_embedding_3_small_1536";

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
      s_function: "embedding",
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
  const result = (await window.roamAlphaAPI.data.backend.q(
    query,
    nodeTypesUids,
  )) as unknown as RoamDiscourseNodeData[];

  const contentData: LocalContentDataInput[] = result.map((node) => ({
    author_id: userId,
    account_local_id: node.author_local_id,
    source_local_id: node.source_local_id,
    created: new Date(node.created || Date.now()).toISOString(),
    last_modified: new Date(node.last_modified || Date.now()).toISOString(),
    text: node.text,
    embedding_inline: {
      model: EMBEDDING_MODEL,
      vector: node.vector,
    },
    scale: "document",
  }));
  const { error } = await supabaseClient.rpc("upsert_content", {
    data: contentData,
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

  const relationSchemas = getDiscourseRelations();

  const relationsToEmbed = relationSchemas.map((relation) => {
    const localConcept = discourseRelationSchemaToLocalConcept(
      context,
      relation,
    );
    return localConcept;
  });

  const nodeBlockToLocalConcepts = nodesSince.map((node) => {
    const localConcept = discourseNodeBlockToLocalConcept(context, {
      nodeUid: node.source_local_id,
      schemaUid: node.type,
      text: node.node_title ? `${node.node_title} ${node.text}` : node.text,
    });
    return localConcept;
  });

  const relationTriples = getDiscourseRelationTriples();
  const relationLabelToId = Object.fromEntries(
    relationSchemas.map((r) => [r.label, r.id]),
  );
  const relationBlockToLocalConcepts = relationTriples
    .map(({ relation, source, target }) => {
      const relationSchemaUid = relationLabelToId[relation];
      if (!relationSchemaUid) {
        return null;
      }
      return discourseRelationDataToLocalConcept(context, relationSchemaUid, {
        source,
        target,
      });
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const conceptsToUpsert = [
    ...nodesTypesToLocalConcepts,
    ...relationsToEmbed,
    ...nodeBlockToLocalConcepts,
    ...relationBlockToLocalConcepts,
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
  const { spaceId, userId } = context;

  if (roamNodes.length === 0) {
    return;
  }

  let nodesWithEmbeddings: RoamDiscourseNodeData[];
  try {
    nodesWithEmbeddings = await fetchEmbeddingsForNodes(roamNodes);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `upsertNodesToSupabaseAsContentWithEmbeddings: Embedding service failed – ${message}`,
    );
    return;
  }

  if (nodesWithEmbeddings.length !== roamNodes.length) {
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

  const uploadBatches = async (batches: RoamDiscourseNodeData[][]) => {
    for (let idx = 0; idx < batches.length; idx++) {
      const batch = batches[idx];

      const contents: LocalContentDataInput[] = batch.map((node) => {
        const variant = node.node_title ? "direct_and_description" : "direct";
        const text = node.node_title
          ? `${node.node_title} ${node.text}`
          : node.text;

        return {
          author_id: userId,
          account_local_id: node.author_local_id,
          source_local_id: node.source_local_id,
          created: new Date(node.created || Date.now()).toISOString(),
          last_modified: new Date(
            node.last_modified || Date.now(),
          ).toISOString(),
          text: text,
          variant: variant,
          embedding_inline: {
            model: EMBEDDING_MODEL,
            vector: node.vector,
          },
          scale: "document",
        };
      });

      const { error } = await supabaseClient.rpc("upsert_content", {
        data: contents,
        v_space_id: spaceId,
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
