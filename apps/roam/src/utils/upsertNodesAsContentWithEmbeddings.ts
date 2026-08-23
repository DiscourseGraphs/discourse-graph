import { type RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import { nextApiRoot } from "@repo/utils/execContext";
import type { LocalContentDataInput } from "@repo/database/inputTypes";
import { crossAppNodeToDbContent } from "@repo/database/lib/crossAppConverters";
import type { CrossAppNode } from "@repo/database/crossAppContracts";
import { contentNodeToCrossApp } from "./roamToCrossAppConverters";

const EMBEDDING_BATCH_SIZE = 200;
const EMBEDDING_MODEL = "openai_text_embedding_3_small_1536";

type EmbeddingApiResponse = {
  data: {
    embedding: number[];
  }[];
};

// The direct content of a node, as the cross-app converters define it. The embedding
// is added afterwards, by fetchEmbeddingsForNodes: it is a concern of the sync only.
export const convertRoamNodeToLocalContent = ({
  nodes,
}: {
  nodes: RoamDiscourseNodeData[];
}): LocalContentDataInput[] =>
  nodes.flatMap((node) => {
    const content = crossAppNodeToDbContent(
      contentNodeToCrossApp(node),
      "direct",
    );
    return content === undefined ? [] : [content];
  });

const fetchEmbeddingVectors = async (texts: string[]): Promise<number[][]> => {
  const allEmbeddings: number[][] = [];
  const allNodesTexts = texts;

  for (let i = 0; i < allNodesTexts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = allNodesTexts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await fetch(nextApiRoot() + "/embeddings/openai/small", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: batch }),
    });

    // TODO: Future: https://github.com/DiscourseGraphs/discourse-graph/pull/343#discussion_r2285566007
    //At some point there were a lot of transient errors with openAI, and retrying was expected. Do you know if this is still the case?
    // One case where I know this would still be true is if we ever run into request throttling, in which case we probably want incremental backoff.
    //  I know we're far from that much usage, but that will become an issue with more adopters. Punting that should at least be a conscious decision.

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

// Embeddings are computed for a node's direct content, and only by the sync:
// nothing else has a reason to pay for them.
export const attachEmbeddingsToNodes = async (
  nodes: CrossAppNode[],
): Promise<void> => {
  if (nodes.length === 0) return;
  const vectors = await fetchEmbeddingVectors(
    nodes.map((node) => node.content.direct.value),
  );
  nodes.forEach((node, i) => {
    node.content.direct.embedding = {
      value: vectors[i],
      embedding: EMBEDDING_MODEL,
    };
  });
};
