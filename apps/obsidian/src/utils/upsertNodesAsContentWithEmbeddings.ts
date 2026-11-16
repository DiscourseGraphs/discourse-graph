import { nextApiRoot } from "@repo/utils/execContext";
import { ObsidianDiscourseNodeData } from "./syncDgNodesToSupabase";
import { default as DiscourseGraphPlugin } from "~/index";

export type ChangedNodeContent = {
  titleEmbedding?: number[];
  fullText?: string;
};

const EMBEDDING_BATCH_SIZE = 200;

type EmbeddingApiResponse = {
  data: {
    embedding: number[];
  }[];
};

const fetchEmbeddings = async (texts: string[]): Promise<number[][]> => {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await fetch(nextApiRoot() + "/embeddings/openai/small", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: batch }),
    });

    if (!response.ok) {
      let errorData;
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

  if (texts.length !== allEmbeddings.length) {
    throw new Error(
      `Mismatch between nodes (${texts.length}) and embeddings (${allEmbeddings.length})`,
    );
  }

  return allEmbeddings;
};

export const buildNodeContentsWithEmbeddings = async ({
  obsidianNodes,
  plugin,
}: {
  obsidianNodes: ObsidianDiscourseNodeData[];
  plugin: DiscourseGraphPlugin;
}): Promise<Record<string, ChangedNodeContent>> => {
  const contentsByNodeId: Record<string, ChangedNodeContent> = {};

  await Promise.all(
    obsidianNodes
      .filter((node) => node.changeTypes.includes("content"))
      .map(async (node) => {
        try {
          contentsByNodeId[node.nodeInstanceId] = {
            fullText: await plugin.app.vault.read(node.file),
          };
        } catch (error) {
          console.error(
            `Error reading file content for ${node.file.path}:`,
            error,
          );
        }
      }),
  );

  const titleChangedNodes = obsidianNodes.filter((node) =>
    node.changeTypes.includes("title"),
  );
  let titleEmbeddings: number[][];
  try {
    titleEmbeddings = await fetchEmbeddings(
      titleChangedNodes.map((node) => node.file.basename),
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `buildNodeContentsWithEmbeddings: Embedding service failed – ${errorMessage}`,
    );
    throw new Error(errorMessage);
  }
  titleChangedNodes.forEach((node, i) => {
    contentsByNodeId[node.nodeInstanceId] = {
      ...contentsByNodeId[node.nodeInstanceId],
      titleEmbedding: titleEmbeddings[i],
    };
  });

  return contentsByNodeId;
};
