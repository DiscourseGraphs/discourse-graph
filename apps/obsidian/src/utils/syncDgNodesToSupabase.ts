/* eslint-disable @typescript-eslint/naming-convention */
import { TFile } from "obsidian";
import { DGSupabaseClient } from "@repo/database/lib/client";
// import { Json } from "@repo/database/dbTypes";
import {
  getSupabaseContext,
  getLoggedInClient,
  SupabaseContext,
} from "./supabaseContext";
import { default as DiscourseGraphPlugin } from "~/index";
// import { DiscourseNode } from "~/types";
import { upsertNodesToSupabaseAsContentWithEmbeddings } from "./upsertNodesAsContentWithEmbeddings";
// TODO: Re-enable concept conversion when ready
// import {
//   discourseNodeSchemaToLocalConcept,
//   discourseNodeBlockToLocalConcept,
//   orderConceptsByDependency,
// } from "./conceptConversion";
// import { LocalConceptDataInput } from "@repo/database/inputTypes";

const DEFAULT_TIME = new Date("1970-01-01");

export type ObsidianDiscourseNodeData = {
  file: TFile;
  frontmatter: Record<string, unknown>;
  nodeTypeId: string;
  nodeInstanceId: string;
  created: string;
  last_modified: string;
};

/**
 * Get the last sync time from the database by querying MAX(last_modified) from Content table
 */
const getLastSyncTime = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<Date> => {
  const { data } = await supabaseClient
    .from("Content")
    .select("last_modified")
    .eq("space_id", spaceId)
    .order("last_modified", { ascending: false })
    .limit(1)
    .maybeSingle();
  return new Date(data?.last_modified || DEFAULT_TIME);
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
 * Get all discourse nodes that were created/updated since lastSyncTime
 * Also detects filename changes even if mtime hasn't changed
 */
const getAllDiscourseNodesSince = async ({
  plugin,
  lastSyncTime,
  supabaseClient,
  context,
  testFolderPath,
}: {
  plugin: DiscourseGraphPlugin;
  lastSyncTime: Date;
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
  const { data: existingContent, error } = await supabaseClient
    .from("Content")
    .select("source_local_id, text")
    .eq("space_id", context.spaceId)
    .in("source_local_id", nodeInstanceIds);

  if (error) {
    console.error("Error fetching existing content:", error);
  }

  const existingTextMap = new Map<string, string>();
  if (existingContent) {
    for (const content of existingContent) {
      if (content.source_local_id && content.text) {
        existingTextMap.set(content.source_local_id, content.text);
      }
    }
  }

  for (const candidate of candidateNodes) {
    const fileMtime = new Date(candidate.file.stat.mtime);
    const currentFilename = candidate.file.basename;
    const existingText = existingTextMap.get(candidate.nodeInstanceId);

    const wasModified = fileMtime > lastSyncTime;
    const filenameChanged =
      existingText !== undefined && existingText !== currentFilename;
    const isNewFile = existingText === undefined;

    if (!wasModified && !filenameChanged && !isNewFile) {
      continue; // File hasn't been modified, filename hasn't changed, and it's not new
    }

    if (isNewFile) {
      console.log(
        `New file detected: ${candidate.nodeInstanceId} with filename "${currentFilename}"`,
      );
    } else if (filenameChanged) {
      console.log(
        `Filename changed for ${candidate.nodeInstanceId}: "${existingText}" -> "${currentFilename}"`,
      );
    }

    nodes.push({
      file: candidate.file,
      frontmatter: candidate.frontmatter,
      nodeTypeId: candidate.nodeTypeId,
      nodeInstanceId: candidate.nodeInstanceId,
      created: new Date(candidate.file.stat.ctime).toISOString(),
      last_modified: new Date(candidate.file.stat.mtime).toISOString(),
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
    if (!supabaseClient) {
      throw new Error("Could not log in to Supabase client");
    }
    console.debug("Supabase client:", supabaseClient);

    const lastSyncTime = await getLastSyncTime(supabaseClient, context.spaceId);
    console.debug("Last sync time:", lastSyncTime);

    // Get all discourse nodes modified since last sync
    // For testing: only sync nodes from specific folder
    // TODO: Remove this after testing
    const testFolderPath =
      "/Users/trang.doan/Documents/Trang Doan Obsidian/Trang Doan/testSyncNodes";
    const allNodeInstances = await getAllDiscourseNodesSince({
      plugin,
      lastSyncTime,
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

    // TODO: Re-enable concept conversion when ready
    // const allDgNodeTypes = plugin.settings.nodeTypes.filter((n) => n.id);

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

    // TODO: Re-enable concept conversion when ready
    // await convertDgToSupabaseConcepts({
    //   nodesSince: allNodeInstances,
    //   allNodeTypes: allDgNodeTypes,
    //   supabaseClient,
    //   context,
    //   accountLocalId,
    // });

    console.debug("Sync completed successfully");
  } catch (error) {
    console.error("createOrUpdateDiscourseEmbedding: Process failed:", error);
    throw error;
  }
};

// TODO: Re-enable concept conversion when ready. Blocked by MAP
// const convertDgToSupabaseConcepts = async ({
//   nodesSince,
//   allNodeTypes,
//   supabaseClient,
//   context,
//   accountLocalId,
// }: {
//   nodesSince: ObsidianDiscourseNodeData[];
//   allNodeTypes: DiscourseNode[];
//   supabaseClient: DGSupabaseClient;
//   context: SupabaseContext;
//   accountLocalId: string;
// }): Promise<void> => {
//   const nodesTypesToLocalConcepts = allNodeTypes.map((node) => {
//     return discourseNodeSchemaToLocalConcept({
//       context,
//       node,
//       accountLocalId,
//     });
//   });
//
//   const nodeBlockToLocalConcepts = nodesSince.map((node) => {
//     return discourseNodeBlockToLocalConcept({
//       context,
//       nodeData: node,
//       accountLocalId,
//     });
//   });
//
//   const conceptsToUpsert: LocalConceptDataInput[] = [
//     ...nodesTypesToLocalConcepts,
//     ...nodeBlockToLocalConcepts,
//   ];
//
//   const { ordered } = orderConceptsByDependency(conceptsToUpsert);
//
//   const { error } = await supabaseClient.rpc("upsert_concepts", {
//     data: ordered as Json,
//     v_space_id: context.spaceId,
//   });
//
//   if (error) {
//     const errorMessage =
//       error instanceof Error
//         ? error.message
//         : typeof error === "string"
//           ? error
//           : JSON.stringify(error, null, 2);
//     throw new Error(`upsert_concepts failed: ${errorMessage}`);
//   }
// };

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
