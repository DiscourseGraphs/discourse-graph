import { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
export type DiscourseGraphContent = {
  author_local_id: string;
  author_name: string;
  source_local_id: string;
  document_local_id?: string;
  created: string;
  last_modified: string;
  text: string;
  model: string;
  vector: number[];
};

const EMBEDDING_BATCH_SIZE = 200;
const API_URL = `https://discoursegraphs.com/api/embeddings/openai/small`;

type EmbeddingApiResponse = {
  data: {
    embedding: number[];
  }[];
};

export const fetchEmbeddingsForNodes = async (
  nodes: RoamDiscourseNodeData[],
): Promise<DiscourseGraphContent[]> => {
  const allEmbeddings: number[][] = [];
  const allNodesTexts = nodes.map((node) => node.text);

  for (let i = 0; i < allNodesTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = allNodesTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    console.log(
      `fetchEmbeddingsForNodes: Fetching batch ${i / EMBEDDING_BATCH_SIZE + 1} of ${allNodesTexts.length / EMBEDDING_BATCH_SIZE}`,
    );

    const response = await fetch(API_URL, {
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
      throw new Error(
        `API Error (${response.status}) processing batch ${
          i / EMBEDDING_BATCH_SIZE + 1
        }: ${errorData.error || "Failed to fetch embeddings"}`,
      );
    }

    const data: EmbeddingApiResponse = await response.json();
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
    model: "openai_text_embedding_3_small_1536",
    vector: allEmbeddings[i],
  }));
};
