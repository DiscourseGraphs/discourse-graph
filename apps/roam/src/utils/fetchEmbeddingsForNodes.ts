/* eslint-disable @typescript-eslint/naming-convention */
import { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";

const EMBEDDING_BATCH_SIZE = 200;
const API_URL = `https://discoursegraphs.com/api/embeddings/openai/small`;
const EMBEDDING_MODEL = "openai_text_embedding_3_small_1536";

type EmbeddingApiResponse = {
  data: {
    embedding: number[];
  }[];
};

export const fetchEmbeddingsForNodes = async (
  nodes: RoamDiscourseNodeData[],
): Promise<RoamDiscourseNodeData[]> => {
  const allEmbeddings: number[][] = [];
  const allNodesTexts = nodes.map((node) =>
    node.node_title ? `${node.node_title} ${node.text}` : node.text,
  );

  for (let i = 0; i < allNodesTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = allNodesTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: batch }),
    });

    if (!response.ok) {
      let errorData: { error: string };
      try {
        errorData = (await response.json()) as { error: string };
      } catch (e) {
        errorData = {
          error: `Server responded with ${response.status}: ${await response.text()}`,
        };
      }
      throw new Error(
        `API Error (${response.status}) processing batch ${
          i / EMBEDDING_BATCH_SIZE + 1
        }: ${errorData.error || "Failed to fetch embeddings"}`,
      );
    }

    const data = (await response.json()) as EmbeddingApiResponse;
    if (!data || !Array.isArray(data.data)) {
      throw new Error(
        `Invalid API response format for batch ${
          i / EMBEDDING_BATCH_SIZE + 1
        }. Expected 'data' array.`,
      );
    }
    const batchEmbeddings = data.data.map((item) => item.embedding);
    allEmbeddings.push(...batchEmbeddings);
  }
  if (nodes.length !== allEmbeddings.length) {
    throw new Error(
      `Mismatch between nodes (${nodes.length}) and embeddings (${allEmbeddings.length})`,
    );
  }
  return nodes.map((node, i) => ({
    ...node,
    model: EMBEDDING_MODEL,
    vector: allEmbeddings[i],
  }));
};
