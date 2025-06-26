// apps/roam/src/utils/embeddingWorkflow.ts
// import { getEmbeddingsService } from "./embeddingService";
import { fetchSupabaseEntity, postBatchToSupabaseApi } from "./supabaseService"; // Ensure postBatchToSupabaseApi is correctly typed for batch operations
import getDiscourseNodes from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";
import { getEmbeddingsService } from "./embeddingService";
import isDiscourseNode from "./isDiscourseNode";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getCurrentUserEmail from "roamjs-components/queries/getCurrentUserEmail";
import getCurrentUserDisplayName from "roamjs-components/queries/getCurrentUserDisplayName";
import { getSupabaseContext } from "./supabaseContext";

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
  "https://discourse-graph-git-store-in-supabase-discourse-graphs.vercel.app";

export const runFullEmbeddingProcess = async (): Promise<void> => {
  console.log("runFullEmbeddingProcess (BATCH API V2): Process started.");
  const context = await getSupabaseContext();
  if (!context) {
    console.error("No Supabase context found.");
    return;
  }
  const { spaceId, userId } = context;

  console.log(
    "runFullEmbeddingProcess (BATCH API V2): Fetching Roam discourse nodes...",
  );
  const roamNodes = await getAllDiscourseNodes();
  console.log(roamNodes.length);
  if (roamNodes.length === 0) {
    console.log(
      "runFullEmbeddingProcess (BATCH API V2): No discourse nodes found in Roam. Exiting.",
    );
    alert("No discourse nodes found in Roam to process.");
    return;
  }
  console.log(
    `runFullEmbeddingProcess (BATCH API V2): Found ${roamNodes.length} discourse nodes.`,
  );

  // --- 5. Generate Embeddings for all nodes ---
  console.log(
    `runFullEmbeddingProcess (BATCH API V2): Generating embeddings for ${roamNodes.length} node titles...`,
  );
  let generatedVectors: number[][];
  try {
    // Assuming getEmbeddingsService can handle an array of RoamContentNode and returns results in the same order
    const embeddingResults = await getEmbeddingsService(roamNodes); // Pass all nodes
    generatedVectors = embeddingResults.map((result) => result.vector);
  } catch (embeddingServiceError: any) {
    console.error(
      `runFullEmbeddingProcess (BATCH API V2): Embedding service failed. Error: ${embeddingServiceError.message}`,
    );
    alert("Critical Error: Failed to generate embeddings. Process halted.");
    return;
  }

  if (generatedVectors.length !== roamNodes.length) {
    console.error(
      "runFullEmbeddingProcess (BATCH API V2): Mismatch between number of nodes and generated embeddings.",
    );
    alert("Critical Error: Mismatch in embedding generation. Process halted.");
    // No throw here, allow graceful exit.
    return;
  }
  console.log(
    "runFullEmbeddingProcess (BATCH API V2): Embeddings generated successfully.",
  );

  // --- 6. BATCH Upload Content and Embeddings to Supabase ---
  console.log(
    `runFullEmbeddingProcess (BATCH API V2): Preparing ${roamNodes.length} Content records for batch upload...`,
  );

  const batchSize = 200;
  for (let i = 0; i < roamNodes.length; i += batchSize) {
    const batch = roamNodes.slice(i, i + batchSize);
    const requestBody = {
      p_space_name: window.roamAlphaAPI.graph.name,
      p_user_email: getCurrentUserEmail(),
      p_user_name: getCurrentUserDisplayName(),
      p_nodes: batch.map((node, indexInBatch) => {
        const embeddingVector = generatedVectors[i + indexInBatch];
        return {
          text: node.string,
          uid: node.uid,
          vector: embeddingVector,
          metadata: {} as Record<string, unknown>,
          created: new Date(node["create/time"] || Date.now()).toISOString(),
          last_modified: new Date(
            node["edit/time"] || Date.now(),
          ).toISOString(),
        };
      }),
    };
    try {
      const response = await fetch(
        `${base_url}/api/supabase/rpc/upsert-discourse-nodes`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(requestBody),
        },
      );

      const responseText = await response.text();

      if (!response.ok) {
        console.error(
          `upsertDiscourseNodes: Failed to upsert discourse nodes. Status: ${response.status}. Body: ${responseText}. Request body (full):`,
          JSON.stringify(requestBody, null, 2),
        );
        throw new Error(
          `Failed to upsert discourse nodes: ${response.status} ${responseText}`,
        );
      }

      let results;
      try {
        results = JSON.parse(responseText);
      } catch (parseError) {
        console.error(
          `upsertDiscourseNodes: Failed to parse JSON response from Supabase. Status: ${response.status}. Raw response: ${responseText}`,
        );
        throw new Error(
          `Failed to parse JSON response from Supabase: ${responseText}`,
        );
      }

      console.log(
        `upsertDiscourseNodes: Successfully processed batch. Response from Supabase:`,
        results,
      );
    } catch (error) {
      console.error(
        `upsertDiscourseNodes: Error during fetch operation for batch starting at index ${i}:`,
        error,
        "Request body (full):",
        JSON.stringify(requestBody, null, 2),
      );
      throw error;
    }
  }
};
