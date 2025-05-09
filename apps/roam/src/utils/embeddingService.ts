import { RoamContentNode } from "./embeddingWorkflow";

export interface NodeWithEmbedding extends RoamContentNode {
  vector: number[];
}

const EMBEDDING_BATCH_SIZE = 100;

export async function getEmbeddingsService(
  nodes: RoamContentNode[],
): Promise<NodeWithEmbedding[]> {
  const isDevelopment = process.env.NODE_ENV === "development";
  const apiUrl = isDevelopment
    ? "http://localhost:3000/api/embeddings/openai/small"
    : "https://discoursegraphs.com/api/embeddings/openai/small";

  const allEmbeddings: number[][] = [];
  const texts = nodes.map((node) => node.string);

  console.log("getEmbeddingsService: Starting to fetch embeddings.");
  try {
    for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
      console.log(
        `getEmbeddingsService: Fetching batch ${i / EMBEDDING_BATCH_SIZE + 1}/${Math.ceil(texts.length / EMBEDDING_BATCH_SIZE)} (size: ${batch.length}) to ${apiUrl}`,
      );

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: batch }),
      });

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = {
            error: `Server responded with ${response.status}: ${await response.text()}`,
          };
        }
        console.error(
          "getEmbeddingsService: Error response from embedding service:",
          errorData,
        );
        throw new Error(
          `API Error (${response.status}) processing batch ${i / EMBEDDING_BATCH_SIZE + 1}: ${errorData.error || "Failed to fetch embeddings"}`,
        );
      }

      const data = await response.json();
      if (!data || !Array.isArray(data.data)) {
        console.error(
          "getEmbeddingsService: Invalid API response format. Received:",
          data,
        );
        throw new Error(
          `Invalid API response format for batch ${i / EMBEDDING_BATCH_SIZE + 1}. Expected 'data' array.`,
        );
      }
      const batchEmbeddings = data.data.map((item: any) => item.embedding);
      console.log(
        `getEmbeddingsService: Batch ${i / EMBEDDING_BATCH_SIZE + 1} embeddings fetched. Count: ${batchEmbeddings.length}`,
      );
      allEmbeddings.push(...batchEmbeddings);
    }
    console.log("getEmbeddingsService: Finished fetching all embeddings.");
    if (nodes.length !== allEmbeddings.length) {
      throw new Error(
        `getEmbeddingsService: Mismatch between nodes (${nodes.length}) and embeddings (${allEmbeddings.length})`,
      );
    }
    return nodes.map((node, i) => ({ ...node, vector: allEmbeddings[i] }));
  } catch (error) {
    console.error("Error in getEmbeddingsService:", error);
    throw error;
  }
}
