// apps/roam/src/utils/embeddingWorkflow.ts
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import {
  getEmbeddingsService,
  type NodeWithEmbedding,
} from "./embeddingService";
import isDiscourseNode from "./isDiscourseNode";
import type {
  LocalContentDataInput,
  LocalDocumentDataInput,
} from "../../../../packages/database/inputTypes.ts";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";

// Type for results from the Roam Datalog query
interface RoamEntityFromQuery {
  ":block/uid": string;
  ":node/title"?: string;
  ":block/string"?: string;
  ":edit/time"?: number;
  ":create/time"?: number;
}

// The structure needed for the embedding process
export interface RoamContentNode {
  uid: string;
  string: string; // Primary text content for embedding - THIS WILL BE THE TITLE
  "edit/time"?: number;
  "create/time"?: number;
}

export async function getAllDiscourseNodes(): Promise<RoamContentNode[]> {
  const roamAlpha = (window as any).roamAlphaAPI;
  const query =
    "[:find (pull ?e [:block/uid :node/title :edit/time :create/time]) :where [?e :node/title]]";
  return (roamAlpha.data.fast.q(query) as [RoamEntityFromQuery][])
    .map(([entity]) => entity)
    .filter(
      (entity) =>
        entity[":block/uid"] &&
        isDiscourseNode(entity[":block/uid"]) &&
        entity[":node/title"] &&
        entity[":node/title"]!.trim() !== "",
    )
    .map((entity) => ({
      uid: entity[":block/uid"],
      string: entity[":node/title"]!.trim(),
      "edit/time": entity[":edit/time"],
      "create/time": entity[":create/time"],
    }));
}

const base_url =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://discourse-graph-git-store-in-supabase-discourse-graphs.vercel.app";

export const runFullEmbeddingProcess = async (): Promise<void> => {
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
  const roamNodes = await getAllDiscourseNodes();
  if (roamNodes.length === 0) {
    console.log("runFullEmbeddingProcess: No discourse nodes found. Exiting.");
    alert("No discourse nodes found in Roam to process.");
    return;
  }
  console.log(
    `runFullEmbeddingProcess: Found ${roamNodes.length} discourse nodes.`,
  );

  // 3. Generate embeddings for every node title
  let nodesWithEmbeddings: NodeWithEmbedding[];
  try {
    console.log("runFullEmbeddingProcess: Generating embeddings…");
    nodesWithEmbeddings = await getEmbeddingsService(roamNodes);
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

  // 4. Build LocalDocumentDataInput objects and upsert them first
  const authorLocalId = getCurrentUserUid();

  const docsData: LocalDocumentDataInput[] = nodesWithEmbeddings.map(
    (node) => ({
      source_local_id: node.uid,
      created: new Date(node["create/time"] || Date.now()).toISOString(),
      last_modified: new Date(node["edit/time"] || Date.now()).toISOString(),
      author_local_id: authorLocalId,
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
      console.error("runFullEmbeddingProcess: upsert_documents failed:", error);
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
      author_local_id: authorLocalId,
      document_local_id: node.uid,
      source_local_id: node.uid,
      scale: "document",
      created: new Date(node["create/time"] || Date.now()).toISOString(),
      last_modified: new Date(node["edit/time"] || Date.now()).toISOString(),
      text: node.string,
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
