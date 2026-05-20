/* eslint-disable @typescript-eslint/naming-convention */
import { type RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";
import { type SupabaseContext } from "./supabaseContext";
import { nextApiRoot } from "@repo/utils/execContext";
import {
  DG_ATJSON_CONTENT_TYPE,
  TEXT_PLAIN_CONTENT_TYPE,
  createDgAtJsonMetadata,
  derivePlainTextFromDgDocument,
  roamTextToDgDocument,
  roamTreeToDgDocument,
  type DgDocument,
  type RoamTreeNode,
} from "@repo/content-model";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Json, CompositeTypes } from "@repo/database/dbTypes";
import getFullTreeByParentUid from "roamjs-components/queries/getFullTreeByParentUid";
import { splitEmbeddableContentNodes } from "./contentEmbeddingSplit";

type LocalContentDataInput = Partial<CompositeTypes<"content_local_input">>;

const EMBEDDING_BATCH_SIZE = 200;
const EMBEDDING_MODEL = "openai_text_embedding_3_small_1536";

type EmbeddingApiResponse = {
  data: {
    embedding: number[];
  }[];
};

type RoamTreeLike = {
  uid?: string;
  text?: string;
  viewType?: "bullet" | "numbered" | "document";
  children?: RoamTreeLike[];
};

const toRoamTreeNode = (
  node: RoamTreeLike,
  fallbackUid: string,
): RoamTreeNode => ({
  uid: node.uid ?? fallbackUid,
  text: node.text ?? "",
  viewType: node.viewType,
  children: (node.children ?? []).map((child, index) =>
    toRoamTreeNode(child, `${fallbackUid}-${index + 1}`),
  ),
});

const createRoamAtJsonDocument = (node: RoamDiscourseNodeData): DgDocument => {
  const title = node.node_title ?? node.text;
  try {
    const tree = getFullTreeByParentUid(node.source_local_id) as RoamTreeLike;
    const treeChildren = node.node_title
      ? [
          toRoamTreeNode(
            {
              ...tree,
              uid: node.source_local_id,
              text: node.text || tree.text,
            },
            node.source_local_id,
          ),
        ]
      : (tree.children ?? []).map((child, index) =>
          toRoamTreeNode(child, `${node.source_local_id}-${index + 1}`),
        );
    return roamTreeToDgDocument({
      title,
      pageUid: node.source_local_id,
      children: treeChildren,
      metadata: {
        sourceLocalId: node.source_local_id,
        nodeTypeId: node.type,
      },
    });
  } catch (error) {
    console.warn(
      `Falling back to text-only Roam ATJSON for ${node.source_local_id}:`,
      error,
    );
    return roamTextToDgDocument({
      title,
      text: node.node_title ? node.text : "",
      sourceLocalId: node.source_local_id,
      metadata: {
        nodeTypeId: node.type,
      },
    });
  }
};

export const convertRoamNodeToLocalContent = ({
  nodes,
}: {
  nodes: RoamDiscourseNodeData[];
}): LocalContentDataInput[] => {
  return nodes.flatMap((node) => {
    const variant = node.node_title ? "direct_and_description" : "direct";
    const text = node.node_title
      ? `${node.node_title} ${node.text}`
      : node.text;
    const baseEntry = {
      author_local_id: node.author_local_id,
      source_local_id: node.source_local_id,
      created: new Date(node.created || Date.now()).toISOString(),
      last_modified: new Date(node.last_modified || Date.now()).toISOString(),
      scale: "document" as const,
    };
    const document = createRoamAtJsonDocument(node);
    return [
      {
        ...baseEntry,
        text: text,
        variant: variant,
        content_type: TEXT_PLAIN_CONTENT_TYPE,
      },
      {
        ...baseEntry,
        text: derivePlainTextFromDgDocument(document),
        variant: "full",
        content_type: DG_ATJSON_CONTENT_TYPE,
        metadata: createDgAtJsonMetadata({ document }) as unknown as Json,
      },
    ];
  });
};

export const fetchEmbeddingsForNodes = async (
  nodes: LocalContentDataInput[],
): Promise<LocalContentDataInput[]> => {
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
): Promise<void> => {
  const { spaceId, userId } = context;
  for (let idx = 0; idx < batches.length; idx++) {
    const batch = batches[idx];
    const { error } = await supabaseClient.rpc("upsert_content", {
      data: batch as unknown as Json,
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
  const { embeddableContentNodes, nonEmbeddableContentNodes } =
    splitEmbeddableContentNodes(localContentNodes);

  let nodesWithEmbeddings: LocalContentDataInput[];
  try {
    nodesWithEmbeddings = await fetchEmbeddingsForNodes(embeddableContentNodes);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `upsertNodesToSupabaseAsContentWithEmbeddings: Embedding service failed - ${errorMessage}`,
    );
    return;
  }

  if (nodesWithEmbeddings.length !== embeddableContentNodes.length) {
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
    chunk([...nodesWithEmbeddings, ...nonEmbeddableContentNodes], batchSize),
    supabaseClient,
    context,
  );
};
