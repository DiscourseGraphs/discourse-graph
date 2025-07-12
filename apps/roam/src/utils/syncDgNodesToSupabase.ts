import { getAllDiscourseNodesSince } from "./getAllDiscourseNodesSince";
import { cleanupOrphanedNodes } from "./cleanupOrphanedNodes";
import { getSupabaseContext } from "./supabaseContext";
import {
  fetchEmbeddingsForNodes,
  DiscourseGraphContent,
} from "./fetchEmbeddingsForNodes";
import {
  LocalDocumentDataInput,
  LocalContentDataInput,
} from "../../../../packages/database/inputTypes";
import { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";

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

async function endSyncTask(
  spaceId: number,
  worker: string,
  status: "complete" | "failed",
): Promise<void> {
  try {
    const SYNC_FUNCTION_NAME = "embedding";
    const endpoint = `${base_url}/api/supabase/sync-task/${SYNC_FUNCTION_NAME}/${spaceId}/${worker}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(status),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `endSyncTask: Failed to end sync task – ${response.status}: ${response.statusText}. Body: ${errorText}`,
      );
    } else {
      console.log(`endSyncTask: Successfully marked task as ${status}`);
    }
  } catch (error) {
    console.error("endSyncTask: Error calling end_sync_task:", error);
  }
}

export async function proposeSyncTask(): Promise<SyncTaskInfo> {
  // Switch to the semaphore-based sync mechanism using propose_sync_task
  try {
    // 1. Resolve (or create) the Supabase space to obtain its numeric Id
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

    const { spaceId } = context;

    // 2. Build the sync-task endpoint URL (function name can be any short identifier)
    const SYNC_FUNCTION_NAME = "embedding";
    const endpoint = `${base_url}/api/supabase/sync-task/${SYNC_FUNCTION_NAME}/${spaceId}`;

    // 3. Provide a stable worker id so we can later mark the task complete
    const worker =
      (window as any).roamAlphaAPI?.user?.uid?.() ??
      (typeof crypto !== "undefined" ? crypto.randomUUID() : "unknown-worker");

    // 4. Call the semaphore endpoint
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ worker }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `proposeSyncTask: propose_sync_task failed – ${response.status}: ${response.statusText}. Body: ${errorText}`,
      );
      return { lastUpdateTime: null, spaceId, worker, shouldProceed: false };
    }

    const data = await response.json();

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
}

export const runFullEmbeddingProcess = async (
  roamNodes: RoamDiscourseNodeData[],
): Promise<void> => {
  console.log("runFullEmbeddingProcess (upsert_content): Process started.");

  // 1. Resolve Supabase context (space/user ids) and create a logged-in client
  const context = await getSupabaseContext();
  if (!context) {
    console.error("runFullEmbeddingProcess: No Supabase context found.");
    return;
  }
  const { spaceId, userId } = context;

  // 2. Gather discourse nodes from Roam
  console.log("runFullEmbeddingProcess: Fetching Roam discourse nodes…");
  if (roamNodes.length === 0) {
    console.log("runFullEmbeddingProcess: No discourse nodes found. Exiting.");
    alert("No discourse nodes found in Roam to process.");
    return;
  }
  console.log(
    `runFullEmbeddingProcess: Found ${roamNodes.length} discourse nodes.`,
  );

  // 3. Generate embeddings for every node title
  let nodesWithEmbeddings: DiscourseGraphContent[];
  try {
    console.log("runFullEmbeddingProcess: Generating embeddings…");
    nodesWithEmbeddings = await fetchEmbeddingsForNodes(roamNodes);
  } catch (error: any) {
    console.error(
      `runFullEmbeddingProcess: Embedding service failed – ${error.message}`,
    );
    alert("Critical Error: Failed to generate embeddings. Process halted.");
    return;
  }

  if (nodesWithEmbeddings.length !== roamNodes.length) {
    console.error(
      "runFullEmbeddingProcess: Mismatch between node and embedding counts.",
    );
    alert("Critical Error: Mismatch in embedding generation. Process halted.");
    return;
  }
  console.log("runFullEmbeddingProcess: Embeddings generated successfully.");

  const docsData: LocalDocumentDataInput[] = nodesWithEmbeddings.map(
    (node) => ({
      source_local_id: node.source_local_id,
      created: new Date(node.created || Date.now()).toISOString(),
      last_modified: new Date(node.last_modified || Date.now()).toISOString(),
      author_id: userId,
    }),
  );

  console.log("runFullEmbeddingProcess: Upserting documents…");
  {
    const response = await fetch(
      `${base_url}/api/supabase/rpc/upsert-documents`,
      {
        method: "POST",
        body: JSON.stringify({
          v_space_id: spaceId,
          data: docsData as any,
        }),
      },
    );
    const { error } = await response.json();
    if (error) {
      console.error(
        "runFullEmbeddingProcess: upsert_documents failed:",
        error,
        "Request body (full):",
        JSON.stringify(docsData, null, 2),
      );
      alert("Failed to upsert documents. Process halted.");
      return;
    }
  }

  console.log("runFullEmbeddingProcess: Documents upserted successfully.");

  // 5. Build LocalContentDataInput objects and upsert them in batches
  const batchSize = 200;

  for (let i = 0; i < nodesWithEmbeddings.length; i += batchSize) {
    const batch = nodesWithEmbeddings.slice(i, i + batchSize);

    const contents: LocalContentDataInput[] = batch.map((node) => ({
      author_local_id: node.author_local_id,
      document_local_id: node.source_local_id,
      source_local_id: node.source_local_id,
      scale: "document",
      created: new Date(node.created || Date.now()).toISOString(),
      last_modified: new Date(node.last_modified || Date.now()).toISOString(),
      text: node.text,
      embedding_inline: {
        model: "openai_text_embedding_3_small_1536",
        vector: node.vector,
      },
    }));

    console.log(
      `runFullEmbeddingProcess: Uploading batch ${i / batchSize + 1} (${contents.length} items)…`,
    );

    const response = await fetch(
      `${base_url}/api/supabase/rpc/upsert-content`,
      {
        method: "POST",
        body: JSON.stringify({
          v_space_id: spaceId,
          v_creator_id: userId,
          data: contents as any,
          content_as_document: false,
        }),
      },
    );
    const { data, error } = await response.json();

    if (error) {
      console.error(
        `runFullEmbeddingProcess: upsert_content failed for batch starting at index ${i}:`,
        error,
      );
      throw error;
    }

    console.log(
      `runFullEmbeddingProcess: Successfully processed batch ${i / batchSize + 1}.`,
      data,
    );
  }

  console.log("runFullEmbeddingProcess: All batches processed successfully.");
};

export const createOrUpdateDiscourseEmbedding = async () => {
  console.log("createOrUpdateDiscourseEmbedding: Starting process.");

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
    const allNodes = await getAllDiscourseNodesSince("1970-01-01");

    // if its null, then run the full embedding process
    if (lastUpdateTime === null) {
      await runFullEmbeddingProcess(allNodes);
    } else {
      const nodesSince = await getAllDiscourseNodesSince(lastUpdateTime);
      await runFullEmbeddingProcess(nodesSince);
      await cleanupOrphanedNodes();
    }

    // Mark task as complete
    await endSyncTask(spaceId, worker, "complete");
    console.log(
      "createOrUpdateDiscourseEmbedding: Process completed successfully.",
    );
  } catch (error) {
    console.error("createOrUpdateDiscourseEmbedding: Process failed:", error);
    // Mark task as failed
    await endSyncTask(spaceId, worker, "failed");
    throw error;
  }
};
