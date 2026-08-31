import { type RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import { type SupabaseContext } from "./supabaseContext";
import { nextApiRoot } from "@repo/utils/execContext";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { LocalContentDataInput } from "@repo/database/inputTypes";
import { upsertContentThroughApi } from "@repo/database/lib/contentApiClient";
import { contentTypes, dgDocumentToPlainText } from "@repo/content-model";
import { buildCanonicalRoamDocument } from "./roamToCrossAppConverters";

const EMBEDDING_BATCH_SIZE = 200;
const EMBEDDING_MODEL = "openai_text_embedding_3_small_1536";

type EmbeddingApiResponse = {
  data: {
    embedding: number[];
  }[];
};

export const convertRoamNodeToLocalContent = ({
  nodes,
}: {
  nodes: RoamDiscourseNodeData[];
}): LocalContentDataInput[] => {
  return nodes.map((node) => {
    const variant = node.node_title ? "direct_and_description" : "direct";
    const text = node.node_title
      ? `${node.node_title} ${node.text}`
      : node.text;
    return {
      author_local_id: node.author_local_id,
      source_local_id: node.source_local_id,
      created: new Date(node.created || Date.now()).toISOString(),
      last_modified: new Date(node.last_modified || Date.now()).toISOString(),
      text: text,
      variant: variant,
      content_type: contentTypes.plainText,
      scale: "document",
    };
  });
};

export const convertRoamNodesToCanonicalContent = ({
  nodes,
}: {
  nodes: RoamDiscourseNodeData[];
}): LocalContentDataInput[] =>
  nodes.flatMap((node) => {
    try {
      const document = buildCanonicalRoamDocument({
        uid: node.source_local_id,
        title: node.node_title ?? node.text,
      });
      return [
        {
          author_local_id: node.author_local_id,
          source_local_id: node.source_local_id,
          created: new Date(node.created || Date.now()).toISOString(),
          last_modified: new Date(
            node.last_modified || Date.now(),
          ).toISOString(),
          text: dgDocumentToPlainText({ document }),
          variant: "full",
          content_type: contentTypes.discourseGraphAtJson,
          scale: "document",
          metadata: { content: document },
          original: false,
        },
      ];
    } catch (error) {
      console.error(
        `Failed to build canonical Roam content for ${node.source_local_id}:`,
        error,
      );
      return [];
    }
  });

export const fetchEmbeddingsForNodes = async (
  nodes: LocalContentDataInput[],
): Promise<LocalContentDataInput[]> => {
  if (nodes.some((node) => node.content_type !== contentTypes.plainText)) {
    throw new Error("Embeddings may only be requested for text/plain content.");
  }
  const allEmbeddings: number[][] = [];
  const allNodesTexts = nodes.map((node) => node.text || "");

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
  if (nodes.length !== allEmbeddings.length) {
    throw new Error(
      `Mismatch between nodes (${nodes.length}) and embeddings (${allEmbeddings.length})`,
    );
  }

  return nodes.map((node, i) => ({
    ...node,
    embedding_inline: {
      model: EMBEDDING_MODEL,
      vector: allEmbeddings[i],
    },
  }));
};

const uploadBatches = async (
  batches: LocalContentDataInput[][],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
) => {
  const { spaceId } = context;
  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];
    try {
      await upsertContentThroughApi({
        client: supabaseClient,
        spaceId,
        request: { content: batch, contentAsDocument: true },
      });
    } catch (error) {
      console.error(`Content API upsert failed for batch ${idx + 1}:`, error);
      throw error;
    }
  }
};

export const upsertNodesToSupabaseAsContentWithEmbeddings = async (
  roamNodes: RoamDiscourseNodeData[],
  supabaseClient: DGSupabaseClient,
  context: SupabaseContext,
): Promise<void> => {
  if (!context?.userId) {
    console.error("No Supabase context found.");
    return;
  }

  if (roamNodes.length === 0) {
    return;
  }
  const localContentNodes = convertRoamNodeToLocalContent({
    nodes: roamNodes,
  });
  const canonicalContentNodes = convertRoamNodesToCanonicalContent({
    nodes: roamNodes,
  });

  let nodesWithEmbeddings: LocalContentDataInput[];
  try {
    nodesWithEmbeddings = await fetchEmbeddingsForNodes(localContentNodes);
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
    chunk([...nodesWithEmbeddings, ...canonicalContentNodes], batchSize),
    supabaseClient,
    context,
  );
};
