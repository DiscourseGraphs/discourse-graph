/* eslint-disable @typescript-eslint/naming-convention */
import { RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import { SupabaseContext } from "./supabaseContext";
import { LocalContentDataInput } from "@repo/database/inputTypes";
import { DGSupabaseClient } from "@repo/ui/lib/supabase/client";
import { Json } from "@repo/database/types.gen";

const EMBEDDING_BATCH_SIZE = 200;
const API_URL = `https://discoursegraphs.com/api/embeddings/openai/small`;

type EmbeddingApiResponse = {
  data: {
    embedding: number[];
  }[];
};

export const fetchEmbeddingsForNodes = async (
  nodes: RoamDiscourseNodeData[],
): Promise<RoamDiscourseNodeData[]> => {
  const allEmbeddings: number[][] = [];
  console.log("nodes", nodes);
  const allNodesTexts = nodes.map((node) =>
    node.node_title ? `${node.node_title} ${node.text}` : node.text,
  );

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
    model: "openai_text_embedding_3_small_1536",
    vector: allEmbeddings[i],
  }));
};

const uploadBatches = async (
  batches: RoamDiscourseNodeData[][],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
) => {
  const { spaceId, userId } = context;
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
        last_modified: new Date(node.last_modified || Date.now()).toISOString(),
        text: text,
        variant: variant,
        embedding_inline: {
          model: "openai_text_embedding_3_small_1536",
          vector: node.vector,
        },
        scale: "document",
      };
    });

    const { error } = await supabaseClient.rpc("upsert_content", {
      data: contents as unknown as Json,
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

export const upsertNodesToSupabaseAsContentWithEmbeddings = async (
  roamNodes: RoamDiscourseNodeData[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<void> => {
  if (!context) {
    console.error("No Supabase context found.");
    return;
  }

  if (roamNodes.length === 0) {
    return;
  }

  let nodesWithEmbeddings: RoamDiscourseNodeData[];
  try {
    nodesWithEmbeddings = await fetchEmbeddingsForNodes(roamNodes);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `upsertNodesToSupabaseAsContentWithEmbeddings: Embedding service failed – ${errorMessage}`,
    );
    return;
  }

  if (nodesWithEmbeddings.length !== roamNodes.length) {
    console.error(
      "upsertNodesToSupabaseAsContentWithEmbeddings: Mismatch between node and embedding counts.",
    );
    return;
  }

  const batchSize = 200;

  const chunk = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  await uploadBatches(
    chunk(nodesWithEmbeddings, batchSize),
    supabaseClient,
    context,
  );
};
