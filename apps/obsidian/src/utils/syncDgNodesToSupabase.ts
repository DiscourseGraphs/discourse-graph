/* eslint-disable @typescript-eslint/naming-convention */
import { TFile } from "obsidian";
import { DGSupabaseClient } from "@repo/database/lib/client";
import { Json } from "@repo/database/dbTypes";
import {
  getSupabaseContext,
  getLoggedInClient,
  SupabaseContext,
} from "./supabaseContext";
import { default as DiscourseGraphPlugin } from "~/index";
import { upsertNodesToSupabaseAsContentWithEmbeddings } from "./upsertNodesAsContentWithEmbeddings";
import {
  orderConceptsByDependency,
  discourseNodeInstanceToLocalConcept,
} from "./conceptConversion";
import { LocalConceptDataInput } from "@repo/database/inputTypes";

export type ChangeType = "title" | "content" | "new";

export type ObsidianDiscourseNodeData = {
  file: TFile;
  frontmatter: Record<string, unknown>;
  nodeTypeId: string;
  nodeInstanceId: string;
  created: string;
  last_modified: string;
  changeTypes: ChangeType[];
};

const ensureNodeInstanceId = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
  frontmatter: Record<string, unknown>,
): Promise<string> => {
  const existingId = frontmatter["nodeInstanceId"] as string | undefined;
  if (existingId && typeof existingId === "string") {
    return existingId;
  }

  const nodeInstanceId = crypto.randomUUID();
  await plugin.app.fileManager.processFrontMatter(file, (fm) => {
    (fm as Record<string, unknown>).nodeInstanceId = nodeInstanceId;
  });

  return nodeInstanceId;
};

/**
 * Get all discourse nodes that have changed compared to what's stored in Supabase.
 * Detects what specifically changed: title, content, or new file
 */
const getChangedDiscourseNodes = async ({
  plugin,
  supabaseClient,
  context,
  testFolderPath,
}: {
  plugin: DiscourseGraphPlugin;
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
  testFolderPath?: string;
}): Promise<ObsidianDiscourseNodeData[]> => {
  const allFiles = plugin.app.vault.getMarkdownFiles();
  const nodes: ObsidianDiscourseNodeData[] = [];
  const candidateNodes: Array<{
    file: TFile;
    frontmatter: Record<string, unknown>;
    nodeTypeId: string;
    nodeInstanceId: string;
  }> = [];

  for (const file of allFiles) {
    // Filter by test folder if specified
    // TODO: Remove this after testing
    if (testFolderPath) {
      const folderName = testFolderPath.split("/").pop() || "";
      if (!file.path.includes(folderName)) {
        continue;
      }
      const pathParts = file.path.split("/");
      if (!pathParts.includes(folderName)) {
        continue;
      }
    }

    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    if (!frontmatter || !frontmatter.nodeTypeId) {
      continue;
    }

    const nodeTypeId = frontmatter.nodeTypeId as string;
    if (!nodeTypeId) {
      continue;
    }

    const nodeInstanceId = await ensureNodeInstanceId(
      plugin,
      file,
      frontmatter as Record<string, unknown>,
    );

    candidateNodes.push({
      file,
      frontmatter: frontmatter as Record<string, unknown>,
      nodeTypeId,
      nodeInstanceId,
    });
  }

  if (candidateNodes.length === 0) {
    return nodes;
  }

  const nodeInstanceIds = candidateNodes.map((n) => n.nodeInstanceId);

  // Query both 'direct' (title) and 'full' (content) variants
  const { data: existingContent, error } = await supabaseClient
    .from("Content")
    .select("source_local_id, text, variant")
    .eq("space_id", context.spaceId)
    .in("variant", ["direct", "full"])
    .in("source_local_id", nodeInstanceIds);

  if (error) {
    console.error("Error fetching existing content:", error);
  }

  console.log(
    `[Debug] SELECT from Content returned ${existingContent?.length ?? 0} rows, error:`,
    error,
  );

  // Build maps for both variants
  const existingDirectMap = new Map<string, string>();
  const existingFullMap = new Map<string, string>();
  if (existingContent) {
    for (const content of existingContent) {
      if (content.source_local_id && content.text) {
        if (content.variant === "direct") {
          existingDirectMap.set(content.source_local_id, content.text);
        } else if (content.variant === "full") {
          existingFullMap.set(content.source_local_id, content.text);
        }
      }
    }
  }

  for (const candidate of candidateNodes) {
    const currentFilename = candidate.file.basename;
    const existingTitle = existingDirectMap.get(candidate.nodeInstanceId);
    const existingFullContent = existingFullMap.get(candidate.nodeInstanceId);

    const isNewFile = existingTitle === undefined;
    const titleChanged =
      existingTitle !== undefined && existingTitle !== currentFilename;

    // Read current file content to compare with stored full content
    let currentContent: string | undefined;
    let contentChanged = false;

    if (!isNewFile) {
      try {
        currentContent = await plugin.app.vault.read(candidate.file);
        contentChanged =
          existingFullContent !== undefined &&
          existingFullContent !== currentContent;
      } catch (e) {
        console.error(`Error reading file ${candidate.file.path}:`, e);
      }
    }

    // Determine what changed
    const changeTypes: ChangeType[] = [];
    if (isNewFile) {
      changeTypes.push("new");
    } else {
      if (titleChanged) {
        changeTypes.push("title");
      }
      if (contentChanged) {
        changeTypes.push("content");
      }
    }

    // Skip if nothing changed
    if (changeTypes.length === 0) {
      continue;
    }

    // Log what changed
    if (isNewFile) {
      console.log(
        `New file detected: ${candidate.nodeInstanceId} with filename "${currentFilename}"`,
      );
    } else {
      if (titleChanged) {
        console.log(
          `Title changed for ${candidate.nodeInstanceId}: "${existingTitle}" -> "${currentFilename}"`,
        );
      }
      if (contentChanged) {
        console.log(
          `Content changed for ${candidate.nodeInstanceId} (filename: "${currentFilename}")`,
        );
      }
    }

    nodes.push({
      file: candidate.file,
      frontmatter: candidate.frontmatter,
      nodeTypeId: candidate.nodeTypeId,
      nodeInstanceId: candidate.nodeInstanceId,
      created: new Date(candidate.file.stat.ctime).toISOString(),
      last_modified: new Date(candidate.file.stat.mtime).toISOString(),
      changeTypes,
    });
  }

  return nodes;
};

export const createOrUpdateDiscourseEmbedding = async (
  plugin: DiscourseGraphPlugin,
  supabaseContext?: SupabaseContext,
): Promise<void> => {
  try {
    console.debug("Starting createOrUpdateDiscourseEmbedding");

    const context = supabaseContext ?? (await getSupabaseContext(plugin));
    if (!context) {
      throw new Error("Could not create Supabase context");
    }

    const supabaseClient = await getLoggedInClient(plugin);
    console.log("supabaseClient", supabaseClient);
    if (!supabaseClient) {
      throw new Error("Could not log in to Supabase client");
    }
    console.debug("Supabase client:", supabaseClient);

    // Get all discourse nodes that have changed compared to what's stored in Supabase
    // For testing: only sync nodes from specific folder
    // TODO: Remove this after testing
    const testFolderPath =
      "/Users/trang.doan/Documents/Trang Doan Obsidian/Trang Doan/testSyncNodes";
    const allNodeInstances = await getChangedDiscourseNodes({
      plugin,
      supabaseClient,
      context,
      testFolderPath, // Remove this parameter to sync all nodes
    });
    console.log("allNodeInstances", allNodeInstances);
    console.debug(`Found ${allNodeInstances.length} nodes to sync`);

    if (allNodeInstances.length === 0) {
      console.debug("No nodes to sync");
      return;
    }

    const accountLocalId = plugin.settings.accountLocalId;
    if (!accountLocalId) {
      throw new Error("accountLocalId not found in plugin settings");
    }

    await upsertNodesToSupabaseAsContentWithEmbeddings({
      obsidianNodes: allNodeInstances,
      supabaseClient,
      context,
      accountLocalId,
      plugin,
    });

    // Only upsert concepts for nodes with title changes or new files
    // (concepts store the title, so content-only changes don't affect them)
    const nodesNeedingConceptUpsert = allNodeInstances.filter(
      (node) =>
        node.changeTypes.includes("new") || node.changeTypes.includes("title"),
    );

    if (nodesNeedingConceptUpsert.length > 0) {
      await convertDgToSupabaseConcepts({
        nodesSince: nodesNeedingConceptUpsert,
        supabaseClient,
        context,
        accountLocalId,
      });
    }

    console.debug("Sync completed successfully");
  } catch (error) {
    console.error("createOrUpdateDiscourseEmbedding: Process failed:", error);
    throw error;
  }
};

const convertDgToSupabaseConcepts = async ({
  nodesSince,
  supabaseClient,
  context,
  accountLocalId,
}: {
  nodesSince: ObsidianDiscourseNodeData[];
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
  accountLocalId: string;
}): Promise<void> => {
  // TODO: handling schema (node types and relations) will be handled in the future by ENG-1181
  // Schema upsert will need allNodeTypes parameter when enabled

  const nodeInstanceToLocalConcepts = nodesSince.map((node) => {
    return discourseNodeInstanceToLocalConcept({
      context,
      nodeData: node,
      accountLocalId,
    });
  });

  const conceptsToUpsert: LocalConceptDataInput[] = [
    // ...nodesTypesToLocalConcepts,
    ...nodeInstanceToLocalConcepts,
  ];

  const { ordered } = orderConceptsByDependency(conceptsToUpsert);

  const { error } = await supabaseClient.rpc("upsert_concepts", {
    data: ordered as Json,
    v_space_id: context.spaceId,
  });

  if (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error, null, 2);
    throw new Error(`upsert_concepts failed: ${errorMessage}`);
  }
};

export const initializeSupabaseSync = async (
  plugin: DiscourseGraphPlugin,
): Promise<void> => {
  const context = await getSupabaseContext(plugin);
  if (!context) {
    throw new Error(
      "Failed to initialize Supabase sync: could not create context",
    );
  }

  await createOrUpdateDiscourseEmbedding(plugin, context).catch((error) => {
    console.error("Initial sync failed:", error);
  });
};
