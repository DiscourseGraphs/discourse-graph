/* eslint-disable @typescript-eslint/naming-convention */
import { nextApiRoot } from "@repo/utils/execContext";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Json, CompositeTypes } from "@repo/database/dbTypes";
import {
  DG_ATJSON_CONTENT_TYPE,
  TEXT_MARKDOWN_CONTENT_TYPE,
  TEXT_PLAIN_CONTENT_TYPE,
  createDgAtJsonMetadata,
  derivePlainTextFromDgDocument,
  obsidianMarkdownToDgDocument,
} from "@repo/content-model";
import type { SupabaseContext } from "./supabaseContext";
import type { ObsidianDiscourseNodeData } from "./syncDgNodesToSupabase";
import type DiscourseGraphPlugin from "~/index";

type LocalContentDataInput = Partial<CompositeTypes<"content_local_input">>;

const EMBEDDING_BATCH_SIZE = 200;
const EMBEDDING_MODEL = "openai_text_embedding_3_small_1536";

type EmbeddingApiResponse = {
  data: {
    embedding: number[];
  }[];
};

const createNodeContentEntries = async (
  node: ObsidianDiscourseNodeData,
  accountLocalId: string,
  plugin: DiscourseGraphPlugin,
): Promise<LocalContentDataInput[]> => {
  const shouldWriteDirect = node.changeTypes.includes("title");
  const shouldWriteMarkdown = node.changeTypes.includes("content");
  const shouldWriteAtJson = shouldWriteDirect || shouldWriteMarkdown;

  if (!shouldWriteDirect && !shouldWriteMarkdown && !shouldWriteAtJson) {
    return [];
  }

  const baseEntry = {
    author_local_id: accountLocalId,
    creator_local_id: accountLocalId,
    source_local_id: node.nodeInstanceId,
    created: node.created,
    last_modified: node.last_modified,
    scale: "document" as const,
  };

  const entries: LocalContentDataInput[] = [];

  // Create direct entry (title) if needed - will get embeddings
  if (shouldWriteDirect) {
    entries.push({
      ...baseEntry,
      text: node.file.basename,
      variant: "direct",
      content_type: TEXT_PLAIN_CONTENT_TYPE,
      metadata: { filePath: node.file.path },
    });
  }

  if (shouldWriteMarkdown || shouldWriteAtJson) {
    try {
      const fullContent = await plugin.app.vault.read(node.file);
      if (shouldWriteMarkdown) {
        entries.push({
          ...baseEntry,
          text: fullContent,
          variant: "full",
          content_type: TEXT_MARKDOWN_CONTENT_TYPE,
          metadata: node.frontmatter as Json,
        });
      }
      const document = obsidianMarkdownToDgDocument({
        title: node.file.basename,
        markdown: fullContent,
        metadata: {
          filePath: node.file.path,
          frontmatter: node.frontmatter as Json,
        },
      });
      if (shouldWriteAtJson) {
        entries.push({
          ...baseEntry,
          text: derivePlainTextFromDgDocument(document),
          variant: "full",
          content_type: DG_ATJSON_CONTENT_TYPE,
          metadata: createDgAtJsonMetadata({ document }) as unknown as Json,
        });
      }
    } catch (error) {
      console.error(`Error reading file content for ${node.file.path}:`, error);
    }
  }

  return entries;
};

export const convertObsidianNodeToLocalContent = async ({
  nodes,
  accountLocalId,
  plugin,
}: {
  nodes: ObsidianDiscourseNodeData[];
  accountLocalId: string;
  plugin: DiscourseGraphPlugin;
}): Promise<LocalContentDataInput[]> => {
  const entriesPerNode = await Promise.all(
    nodes.map((node) => createNodeContentEntries(node, accountLocalId, plugin)),
  );
  return entriesPerNode.flat();
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
      vector: allEmbeddings[i] as number[],
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

export const upsertNodesToSupabaseAsContentWithEmbeddings = async ({
  obsidianNodes,
  supabaseClient,
  context,
  accountLocalId,
  plugin,
}: {
  obsidianNodes: ObsidianDiscourseNodeData[];
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
  accountLocalId: string;
  plugin: DiscourseGraphPlugin;
}): Promise<void> => {
  if (!context?.userId) {
    console.error("No Supabase context found.");
    return;
  }

  if (obsidianNodes.length === 0) {
    return;
  }

  // Create representation rows based on the changed slice: title, Markdown body, and canonical ATJSON.
  const allContentEntries = await convertObsidianNodeToLocalContent({
    nodes: obsidianNodes,
    accountLocalId,
    plugin,
  });

  const directVariantEntries = allContentEntries.filter(
    (entry) =>
      entry.variant === "direct" &&
      (entry.content_type ?? TEXT_PLAIN_CONTENT_TYPE) ===
        TEXT_PLAIN_CONTENT_TYPE,
  );
  const fullVariantEntries = allContentEntries.filter(
    (entry) =>
      entry.variant === "full" ||
      (entry.content_type ?? TEXT_PLAIN_CONTENT_TYPE) !==
        TEXT_PLAIN_CONTENT_TYPE,
  );

  let directEntriesWithEmbeddings: LocalContentDataInput[];
  try {
    directEntriesWithEmbeddings =
      await fetchEmbeddingsForNodes(directVariantEntries);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(
      `upsertNodesToSupabaseAsContentWithEmbeddings: Embedding service failed - ${errorMessage}`,
    );
    throw new Error(errorMessage);
  }

  if (directEntriesWithEmbeddings.length !== directVariantEntries.length) {
    console.error(
      "upsertNodesToSupabaseAsContentWithEmbeddings: Mismatch between direct variant entries and embedding counts.",
    );
    throw new Error(
      "upsertNodesToSupabaseAsContentWithEmbeddings: Mismatch between direct variant entries and embedding counts.",
    );
  }

  const allEntriesToUpload = [
    ...directEntriesWithEmbeddings,
    ...fullVariantEntries,
  ];

  const batchSize = 200;

  const chunk = <T>(array: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  };

  await uploadBatches(
    chunk(allEntriesToUpload, batchSize),
    supabaseClient,
    context,
  );
};
