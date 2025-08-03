import {
  getAllDiscourseNodesSince,
  forAllDiscourseNodeTypeBlockNodes,
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

const base_url =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://discourse-graph-git-store-in-supabase-discourse-graphs.vercel.app";

type SyncTaskInfo = {
  lastUpdateTime: string | null;
  spaceId: number;
  worker: string;
  shouldProceed: boolean;
};

export const endSyncTask = async (
  spaceId: number,
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
    const { data, error } = await supabaseClient.rpc("end_sync_task", {
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
  // Switch to the semaphore-based sync mechanism using propose_sync_task
  try {
    // 1. Resolve (or create) the Supabase space to obtain its numeric Id
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
    const worker =
      (window as any).roamAlphaAPI?.user?.uid?.() ??
      (typeof crypto !== "undefined" ? crypto.randomUUID() : "unknown-worker");

    const { data, error } = await supabaseClient.rpc("propose_sync_task", {
      s_target: context.spaceId,
      s_function: "embedding",
      s_worker: worker,
      task_interval: "45s",
      timeout: "20s",
    });

    const { spaceId } = context;

    // 2. Build the sync-task endpoint URL (function name can be any short identifier)

    if (error) {
      console.error(
        `proposeSyncTask: propose_sync_task failed – ${error.message}`,
      );
      return { lastUpdateTime: null, spaceId, worker, shouldProceed: false };
    }

    console.log("proposeSyncTask: Response from propose_sync_task:", data);

    // Check if another worker is already running this task
    if (typeof data === "string") {
      const timestamp = new Date(data);
      const now = new Date();

      if (timestamp > now) {
        // Future timestamp means another worker is running
        console.log(
          "proposeSyncTask: Another worker is already running this task",
        );
        return { lastUpdateTime: null, spaceId, worker, shouldProceed: false };
      } else {
        // Past timestamp is the last successful run
        return { lastUpdateTime: data, spaceId, worker, shouldProceed: true };
      }
    }

    // boolean true or any other value => treat as 'no previous run'
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
const upsertNodeSchemaToContent = async (
  nodesUids: string[],
  spaceId: number,
  userId: number,
  supabaseClient: DGSupabaseClient,
) => {
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
    nodesUids,
  )) as unknown as RoamDiscourseNodeData[];

  const contentData: LocalContentDataInput[] = result.map((node) => ({
    author_id: userId,
    account_local_id: node.author_local_id,
    source_local_id: node.source_local_id,
    created: new Date(node.created || Date.now()).toISOString(),
    last_modified: new Date(node.last_modified || Date.now()).toISOString(),
    text: node.text,
    embedding_inline: {
      model: "openai_text_embedding_3_small_1536",
      vector: node.vector,
    },
    scale: "document",
  }));
  const { data, error } = await supabaseClient.rpc("upsert_content", {
    data: contentData as any,
    v_space_id: spaceId,
    v_creator_id: userId,
    content_as_document: true,
  });
  if (error) {
    console.error("upsert_content failed:", error);
  }
  console.log("contentData upserted successfully", data);
};

export const convertDgToSupabaseConcepts = async (
  nodesSince: RoamDiscourseNodeData[],
  since: string,
  allNodeTypes: DiscourseNode[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
) => {
  console.log("Upserting concepts to Supabase: Starting process.");

  if (!context) {
    console.error("Could not get Supabase context. Aborting update.");
    return;
  }
  const sinceMsNumber = new Date(since).getTime();
  const nodeTypes = await nodeTypeSince(sinceMsNumber, allNodeTypes);
  await upsertNodeSchemaToContent(
    nodeTypes.map((node) => node.type),
    context.spaceId,
    context.userId,
    supabaseClient,
  );

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
  const { ordered, missing } = orderConceptsByDependency(conceptsToUpsert);
  console.log("ordered", ordered);
  console.log("missing", missing);
  console.log("upserting concepts to supabase", ordered);
  const { data, error } = await supabaseClient.rpc("upsert_concepts", {
    data: ordered,
    v_space_id: context.spaceId,
  });
  if (error) {
    throw new Error(
      `upsert_concepts failed: ${JSON.stringify(error, null, 2)}`,
    );
  }
  console.log("Successfully upserted concepts.");
};

export const upsertNodesToSupabaseAsContentWithEmbeddings = async (
  roamNodes: RoamDiscourseNodeData[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<void> => {
  console.log(
    "upsertNodesToSupabaseAsContentWithEmbeddings (upsert_content): Process started.",
  );

  if (!context) {
    console.error("No Supabase context found.");
    return;
  }
  const { spaceId, userId } = context;

  console.log("Fetching Roam discourse nodes…");
  if (roamNodes.length === 0) {
    console.log("No discourse nodes found. Exiting.");
    return;
  }
  console.log(`Found ${roamNodes.length} discourse nodes.`);

  let nodesWithEmbeddings: RoamDiscourseNodeData[];
  try {
    console.log(" Generating embeddings…");
    nodesWithEmbeddings = await fetchEmbeddingsForNodes(roamNodes);
    console.log(" Embeddings generated successfully.");
  } catch (error: any) {
    console.error(
      `upsertNodesToSupabaseAsContentWithEmbeddings: Embedding service failed – ${error.message}`,
    );
    console.log(
      "Critical Error: Failed to generate embeddings. Process halted.",
    );
    return;
  }

  if (nodesWithEmbeddings.length !== roamNodes.length) {
    console.error(
      "upsertNodesToSupabaseAsContentWithEmbeddings: Mismatch between node and embedding counts.",
    );
    console.log(
      "Critical Error: Mismatch in embedding generation. Process halted.",
    );
    return;
  }
  console.log(
    "upsertNodesToSupabaseAsContentWithEmbeddings: Embeddings generated successfully.",
  );

  // 5. Build LocalContentDataInput objects and upsert them in batches
  const batchSize = 200;

  // Helper to chunk arrays
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

      // Don't pass the author_local_id or document_local_id to the upsert-content directly
      // use document_inline or author_inline instead
      const contents: LocalContentDataInput[] = batch.map((node) => {
        const variant = node.node_title ? "direct_and_description" : "direct";
        const text = node.node_title
          ? `${node.node_title} ${node.text}`
          : node.text;
        //console.log("node content", node);

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
            model: "openai_text_embedding_3_small_1536",
            vector: node.vector,
          },
          scale: "document",
        };
      });

      console.log(
        `Uploading document batch ${idx + 1} (${contents.length} items)…`,
        contents,
      );

      const { data, error } = await supabaseClient.rpc("upsert_content", {
        data: contents as any,
        v_space_id: spaceId,
        v_creator_id: userId,
        content_as_document: true,
      });

      if (error) {
        console.error(`upsert_content failed for batch ${idx + 1}:`, error);
        throw error;
      }

      console.log(`Successfully processed batch ${idx + 1}.`, data);
    }
  };

  // We simply process the provided list with the supplied flag
  await uploadBatches(chunk(nodesWithEmbeddings, batchSize));

  console.log("All batches processed successfully.");
};

const specialNodes = (extensionAPI: OnloadArgs["extensionAPI"]) => {
  const allNodeTypes = getDiscourseNodes().filter((n) => n.backedBy === "user");
  const specialNodeTypes = allNodeTypes.filter((n) => {
    const settingsKey = `discourse-graph-node-rule-${n.type}`;
    const settings = extensionAPI.settings.get(settingsKey) as
      | {
          isFirstChild?: boolean;
          embeddingRef?: string;
        }
      | undefined;
    return settings?.isFirstChild || settings?.embeddingRef;
  });
  return { allNodeTypes, specialNodeTypes };
};

export const createOrUpdateDiscourseEmbedding = async (
  extensionAPI: OnloadArgs["extensionAPI"],
) => {
  const syncInfo = await proposeSyncTask();

  if (!syncInfo.shouldProceed) {
    console.log(
      "createOrUpdateDiscourseEmbedding: Task already running or failed to acquire lock. Exiting.",
    );
    return;
  }

  const { lastUpdateTime, spaceId, worker } = syncInfo;
  console.log("Last update time:", lastUpdateTime);

  try {
    const time = lastUpdateTime === null ? "1970-01-01" : lastUpdateTime;
    console.log("last update time", time);
    const { allNodeTypes, specialNodeTypes } = specialNodes(extensionAPI);
    console.log("special nodes", specialNodeTypes);
    console.log("allNodeTypes", allNodeTypes);

    const pageNodes = await getAllDiscourseNodesSince(
      time,
      specialNodeTypes,
      extensionAPI,
    );
    console.log("pageNodes", pageNodes);
    const supabaseClient = await getLoggedInClient();
    const context = await getSupabaseContext();
    if (!context) {
      console.error("No Supabase context found.");
      return;
    }
    const { spaceId, userId } = context;
    await upsertNodesToSupabaseAsContentWithEmbeddings(
      pageNodes,
      supabaseClient,
      context,
    );
    await convertDgToSupabaseConcepts(
      pageNodes,
      time,
      allNodeTypes,
      supabaseClient,
      context,
    );
    await cleanupOrphanedNodes(supabaseClient, context);
    await endSyncTask(spaceId, worker, "complete");
  } catch (error) {
    console.error("createOrUpdateDiscourseEmbedding: Process failed:", error);
    await endSyncTask(spaceId, worker, "failed");
    throw error;
  }
};
