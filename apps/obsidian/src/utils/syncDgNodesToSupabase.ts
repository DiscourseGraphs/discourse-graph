/* eslint-disable @typescript-eslint/naming-convention */
import { Notice, TFile } from "obsidian";
import { ensureNodeInstanceId } from "~/utils/nodeInstanceId";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { Json } from "@repo/database/dbTypes";
import {
  getSupabaseContext,
  getLoggedInClient,
  type SupabaseContext,
} from "./supabaseContext";
import { default as DiscourseGraphPlugin } from "~/index";
import { upsertNodesToSupabaseAsContentWithEmbeddings } from "./upsertNodesAsContentWithEmbeddings";
import {
  orderConceptsByDependency,
  discourseNodeInstanceToLocalConcept,
  discourseNodeSchemaToLocalConcept,
} from "./conceptConversion";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";

const DEFAULT_TIME = "1970-01-01";
export type ChangeType = "title" | "content";

export type ObsidianDiscourseNodeData = {
  file: TFile;
  frontmatter: Record<string, unknown>;
  nodeTypeId: string;
  nodeInstanceId: string;
  created: string;
  last_modified: string;
  changeTypes: ChangeType[];
};

export type DiscourseNodeFileChange = {
  filePath: string;
  changeTypes: ChangeType[];
  oldPath?: string;
};

const getAllNodeInstanceIdsFromSupabase = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<string[]> => {
  try {
    const { data, error } = await supabaseClient
      .from("Content")
      .select("source_local_id")
      .eq("space_id", spaceId)
      .eq("scale", "document")
      .not("source_local_id", "is", null);

    if (error) {
      console.error(
        "Failed to get discourse node content from Supabase:",
        error,
      );
      return [];
    }

    const sourceLocalIds =
      data
        ?.map((c: { source_local_id: string | null }) => c.source_local_id)
        .filter((id: string | null): id is string => !!id) || [];

    return [...new Set(sourceLocalIds)];
  } catch (error) {
    console.error("Error in getAllNodeInstanceIdsFromSupabase:", error);
    return [];
  }
};

type DeleteNodesResult = {
  success: boolean;
  errors: {
    concept?: unknown;
    content?: unknown;
    document?: unknown;
    unexpected?: unknown;
  };
};

const deleteNodesFromSupabase = async (
  nodeInstanceIds: string[],
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<DeleteNodesResult> => {
  const result: DeleteNodesResult = {
    success: true,
    errors: {},
  };

  try {
    if (nodeInstanceIds.length === 0) {
      return result;
    }

    const { error: conceptDeleteError } = await supabaseClient
      .from("Concept")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", nodeInstanceIds)
      .eq("is_schema", false);

    if (conceptDeleteError) {
      result.success = false;
      result.errors.concept = conceptDeleteError;
      console.error(
        "Failed to delete concepts from Supabase:",
        conceptDeleteError,
      );
    }

    const { error: contentDeleteError } = await supabaseClient
      .from("Content")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", nodeInstanceIds);

    if (contentDeleteError) {
      result.success = false;
      result.errors.content = contentDeleteError;
      console.error(
        "Failed to delete content from Supabase:",
        contentDeleteError,
      );
    }

    const { error: documentDeleteError } = await supabaseClient
      .from("Document")
      .delete()
      .eq("space_id", spaceId)
      .in("source_local_id", nodeInstanceIds);

    if (documentDeleteError) {
      result.success = false;
      result.errors.document = documentDeleteError;
      console.error(
        "Failed to delete documents from Supabase:",
        documentDeleteError,
      );
    }
  } catch (error) {
    result.success = false;
    result.errors.unexpected = error;
    console.error("Error in deleteNodesFromSupabase:", error);
  }

  return result;
};

const getLastContentSyncTime = async (
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
  return new Date((data?.last_modified || DEFAULT_TIME) + "Z");
};

const getLastSchemaSyncTime = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
): Promise<Date> => {
  const { data } = await supabaseClient
    .from("Concept")
    .select("last_modified")
    .eq("space_id", spaceId)
    .eq("is_schema", true)
    .order("last_modified", { ascending: false })
    .limit(1)
    .maybeSingle();
  return new Date((data?.last_modified || DEFAULT_TIME) + "Z");
};

type DiscourseNodeInVault = {
  file: TFile;
  frontmatter: Record<string, unknown>;
  nodeTypeId: string;
  nodeInstanceId: string;
};

type BuildChangedNodesOptions = {
  nodes: DiscourseNodeInVault[];
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
  changeTypesByPath?: Map<string, ChangeType[]>;
};

const mergeChangeTypes = (
  base: ChangeType[],
  additional: ChangeType[],
): ChangeType[] => {
  const merged = new Set<ChangeType>([...base, ...additional]);
  return Array.from(merged);
};

/**
 * Step 1: Collect all discourse nodes from the vault
 * Filters markdown files that have nodeTypeId in frontmatter
 */
const collectDiscourseNodesFromVault = async (
  plugin: DiscourseGraphPlugin,
): Promise<DiscourseNodeInVault[]> => {
  const allFiles = plugin.app.vault.getMarkdownFiles();
  const dgNodes: DiscourseNodeInVault[] = [];

  for (const file of allFiles) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    // Not a discourse node
    if (!frontmatter?.nodeTypeId) {
      continue;
    }

    if (frontmatter.importedFromSpaceUri) {
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

    dgNodes.push({
      file,
      frontmatter: frontmatter as Record<string, unknown>,
      nodeTypeId,
      nodeInstanceId,
    });
  }

  return dgNodes;
};

const getOrphanedNodeInstanceIds = async ({
  plugin,
  supabaseClient,
  context,
}: {
  plugin: DiscourseGraphPlugin;
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
}): Promise<string[]> => {
  const dgNodesInVault = await collectDiscourseNodesFromVault(plugin);
  const vaultNodeIds = new Set(
    dgNodesInVault.map((node) => node.nodeInstanceId),
  );
  const supabaseNodeIds = await getAllNodeInstanceIdsFromSupabase(
    supabaseClient,
    context.spaceId,
  );

  return supabaseNodeIds.filter((nodeId) => !vaultNodeIds.has(nodeId));
};

/**
 * Query database for existing titles (from "direct" variant)
 * Returns a map of nodeInstanceId -> stored filename
 */
const getExistingTitlesFromDatabase = async (
  supabaseClient: DGSupabaseClient,
  spaceId: number,
  nodeInstanceIds: string[],
): Promise<Map<string, string>> => {
  const { data: existingDirectContent, error: directError } =
    await supabaseClient
      .from("Content")
      .select("source_local_id, text")
      .eq("space_id", spaceId)
      .eq("variant", "direct")
      .in("source_local_id", nodeInstanceIds);

  if (directError) {
    console.error("Error fetching existing direct content:", directError);
  }

  const titleMap = new Map<string, string>();
  if (existingDirectContent) {
    for (const content of existingDirectContent) {
      if (content.source_local_id && content.text) {
        titleMap.set(content.source_local_id, content.text);
      }
    }
  }

  return titleMap;
};

const detectNodeChanges = (
  node: DiscourseNodeInVault,
  existingTitle: string | undefined,
  lastSyncTime: Date,
): ChangeType[] => {
  const currentFilename = node.file.basename;
  const fileModifiedTime = new Date(node.file.stat.mtime);

  const isNewFile = existingTitle === undefined;
  if (isNewFile) {
    return ["title", "content"];
  }

  const titleChanged = existingTitle !== currentFilename;
  const contentChanged = fileModifiedTime > lastSyncTime;

  const changeTypes: ChangeType[] = [];
  if (titleChanged) {
    changeTypes.push("title");
  }
  if (contentChanged) {
    changeTypes.push("content");
  }

  return changeTypes;
};

const logNodeChanges = ({
  node,
  changeTypes,
  existingTitle,
  lastSyncTime,
}: {
  node: DiscourseNodeInVault;
  changeTypes: ChangeType[];
  existingTitle: string | undefined;
  lastSyncTime: Date;
}): void => {
  const currentFilename = node.file.basename;
  const fileModifiedTime = new Date(node.file.stat.mtime);

  if (changeTypes.includes("title")) {
    console.log(
      `Title changed for ${node.nodeInstanceId}: "${existingTitle}" -> "${currentFilename}"`,
    );
  }

  if (changeTypes.includes("content")) {
    console.log(
      `Content changed for ${node.nodeInstanceId} (filename: "${currentFilename}") - file mtime: ${fileModifiedTime.toISOString()}, lastSyncTime: ${lastSyncTime.toISOString()}`,
    );
  }
};

const buildChangedNodesFromNodes = async ({
  nodes,
  supabaseClient,
  context,
  changeTypesByPath,
}: BuildChangedNodesOptions): Promise<ObsidianDiscourseNodeData[]> => {
  if (nodes.length === 0) {
    return [];
  }

  const nodeInstanceIds = nodes.map((node) => node.nodeInstanceId);
  const existingTitleMap = await getExistingTitlesFromDatabase(
    supabaseClient,
    context.spaceId,
    nodeInstanceIds,
  );

  const lastSyncTime = await getLastContentSyncTime(
    supabaseClient,
    context.spaceId,
  );
  const changedNodes: ObsidianDiscourseNodeData[] = [];

  for (const node of nodes) {
    const existingTitle = existingTitleMap.get(node.nodeInstanceId);
    const detectedChangeTypes = detectNodeChanges(
      node,
      existingTitle,
      lastSyncTime,
    );
    const overrideChangeTypes = changeTypesByPath?.get(node.file.path) ?? [];
    const mergedChangeTypes =
      overrideChangeTypes.length > 0
        ? mergeChangeTypes(overrideChangeTypes, detectedChangeTypes)
        : detectedChangeTypes;
    const finalChangeTypes = mergedChangeTypes;

    if (finalChangeTypes.length === 0) {
      continue;
    }

    logNodeChanges({
      node,
      changeTypes: finalChangeTypes,
      existingTitle,
      lastSyncTime,
    });

    changedNodes.push({
      file: node.file,
      frontmatter: node.frontmatter,
      nodeTypeId: node.nodeTypeId,
      nodeInstanceId: node.nodeInstanceId,
      created: new Date(node.file.stat.ctime).toISOString(),
      last_modified: new Date(node.file.stat.mtime).toISOString(),
      changeTypes: finalChangeTypes,
    });
  }

  return changedNodes;
};

/**
 * Get all discourse nodes that have changed compared to what's stored in Supabase.
 * Detects what specifically changed: title, content, or new file
 *
 * Flow:
 * 1. Collect all discourse nodes from vault
 * 2. Query database for existing titles
 * 3. Get last sync time for the space
 * 4. For each node, detect what changed
 * 5. Return only nodes that have changes
 */
const getChangedDiscourseNodes = async ({
  plugin,
  supabaseClient,
  context,
}: {
  plugin: DiscourseGraphPlugin;
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
}): Promise<ObsidianDiscourseNodeData[]> => {
  const dgNodesInVault = await collectDiscourseNodesFromVault(plugin);

  return buildChangedNodesFromNodes({
    nodes: dgNodesInVault,
    supabaseClient,
    context,
  });
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
    const allNodeInstances = await getChangedDiscourseNodes({
      plugin,
      supabaseClient,
      context,
    });
    console.log("allNodeInstances", allNodeInstances);
    console.debug(`Found ${allNodeInstances.length} nodes to sync`);

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

    await convertDgToSupabaseConcepts({
      nodesSince: allNodeInstances,
      supabaseClient,
      context,
      accountLocalId,
      plugin,
    });

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
  plugin,
}: {
  nodesSince: ObsidianDiscourseNodeData[];
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
  accountLocalId: string;
  plugin: DiscourseGraphPlugin;
}): Promise<void> => {
  const lastSchemaSync = (
    await getLastSchemaSyncTime(supabaseClient, context.spaceId)
  ).getTime();
  const newNodeTypes = (plugin.settings.nodeTypes ?? []).filter(
    (n) => n.modified > lastSchemaSync,
  );

  const nodesTypesToLocalConcepts = newNodeTypes.map((nodeType) =>
    discourseNodeSchemaToLocalConcept({
      context,
      node: nodeType,
      accountLocalId,
    }),
  );

  const nodeInstanceToLocalConcepts = nodesSince.map((node) =>
    discourseNodeInstanceToLocalConcept({
      context,
      nodeData: node,
      accountLocalId,
    }),
  );

  const conceptsToUpsert: LocalConceptDataInput[] = [
    ...nodesTypesToLocalConcepts,
    ...nodeInstanceToLocalConcepts,
  ];

  if (conceptsToUpsert.length > 0) {
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
  }
};

/**
 * Shared function to sync changed nodes to Supabase
 * Handles content/embedding upsert and concept upsert
 */
const syncChangedNodesToSupabase = async ({
  changedNodes,
  plugin,
  supabaseClient,
  context,
  accountLocalId,
}: {
  changedNodes: ObsidianDiscourseNodeData[];
  plugin: DiscourseGraphPlugin;
  supabaseClient: DGSupabaseClient;
  context: SupabaseContext;
  accountLocalId: string;
}): Promise<void> => {
  if (changedNodes.length > 0) {
    await upsertNodesToSupabaseAsContentWithEmbeddings({
      obsidianNodes: changedNodes,
      supabaseClient,
      context,
      accountLocalId,
      plugin,
    });
  }

  // Only upsert concepts for nodes with title changes or new files
  // (concepts store the title, so content-only changes don't affect them)
  const nodesNeedingConceptUpsert = changedNodes.filter((node) =>
    node.changeTypes.includes("title"),
  );

  await convertDgToSupabaseConcepts({
    nodesSince: nodesNeedingConceptUpsert,
    supabaseClient,
    context,
    accountLocalId,
    plugin,
  });
};

/**
 * Collect discourse nodes from specific file paths
 */
const collectDiscourseNodesFromPaths = async (
  plugin: DiscourseGraphPlugin,
  filePaths: string[],
): Promise<DiscourseNodeInVault[]> => {
  const dgNodes: DiscourseNodeInVault[] = [];

  for (const filePath of filePaths) {
    const file = plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      console.debug(`File not found or not a TFile: ${filePath}`);
      continue;
    }

    // Only process markdown files
    if (!file.path.endsWith(".md")) {
      continue;
    }

    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    // Not a discourse node
    if (!frontmatter?.nodeTypeId) {
      console.debug(`File is not a DG node: ${filePath}`);
      continue;
    }

    if (frontmatter.importedFromSpaceUri) {
      console.debug(`Skipping imported file: ${filePath}`);
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

    dgNodes.push({
      file,
      frontmatter: frontmatter as Record<string, unknown>,
      nodeTypeId,
      nodeInstanceId,
    });
  }

  return dgNodes;
};

/**
 * Sync specific files by their paths
 * Used by FileChangeListener to sync only changed files
 */
export const syncSpecificFiles = async (
  plugin: DiscourseGraphPlugin,
  filePaths: string[],
): Promise<void> => {
  const changeTypesByPath = new Map<string, ChangeType[]>();
  for (const filePath of filePaths) {
    const existing = changeTypesByPath.get(filePath) ?? [];
    changeTypesByPath.set(filePath, mergeChangeTypes(existing, ["content"]));
  }

  await syncDiscourseNodeChanges(plugin, changeTypesByPath);
};

/**
 * Sync nodes based on explicit file change metadata.
 */
export const syncDiscourseNodeChanges = async (
  plugin: DiscourseGraphPlugin,
  changeTypesByPath: Map<string, ChangeType[]>,
): Promise<void> => {
  try {
    const filePaths = Array.from(changeTypesByPath.keys());

    console.debug(
      `Syncing ${filePaths.length} file change(s) with explicit types`,
    );

    if (filePaths.length === 0) {
      console.debug("No files to sync");
      return;
    }

    const context = await getSupabaseContext(plugin);
    if (!context) {
      throw new Error("Could not create Supabase context");
    }

    const supabaseClient = await getLoggedInClient(plugin);
    if (!supabaseClient) {
      throw new Error("Could not log in to Supabase client");
    }

    const dgNodesInVault = await collectDiscourseNodesFromPaths(
      plugin,
      filePaths,
    );

    if (dgNodesInVault.length === 0) {
      console.debug("No DG nodes found in specified files");
      return;
    }

    const changedNodes = await buildChangedNodesFromNodes({
      nodes: dgNodesInVault,
      supabaseClient,
      context,
      changeTypesByPath,
    });

    const accountLocalId = plugin.settings.accountLocalId;
    if (!accountLocalId) {
      throw new Error("accountLocalId not found in plugin settings");
    }

    await syncChangedNodesToSupabase({
      changedNodes,
      plugin,
      supabaseClient,
      context,
      accountLocalId,
    });

    console.debug(`Successfully synced ${changedNodes.length} node(s)`);
  } catch (error) {
    console.error("syncDiscourseNodeChanges: Process failed:", error);
    throw error;
  }
};

export const cleanupOrphanedNodes = async (
  plugin: DiscourseGraphPlugin,
): Promise<number> => {
  try {
    const context = await getSupabaseContext(plugin);
    if (!context) {
      throw new Error("Could not create Supabase context");
    }

    const supabaseClient = await getLoggedInClient(plugin);
    if (!supabaseClient) {
      throw new Error("Could not log in to Supabase client");
    }

    const orphanedNodeIds = await getOrphanedNodeInstanceIds({
      plugin,
      supabaseClient,
      context,
    });

    if (orphanedNodeIds.length === 0) {
      return 0;
    }

    const deleteResult = await deleteNodesFromSupabase(
      orphanedNodeIds,
      supabaseClient,
      context.spaceId,
    );

    if (!deleteResult.success) {
      const errorMessages = Object.entries(deleteResult.errors)
        .filter(([, error]) => error !== undefined)
        .map(
          ([table, error]) =>
            `${table}: ${error instanceof Error ? error.message : String(error)}`,
        )
        .join(", ");
      console.error(
        `Partial failure deleting orphaned nodes: ${errorMessages}`,
      );
    }

    return orphanedNodeIds.length;
  } catch (error) {
    console.error("cleanupOrphanedNodes: Process failed:", error);
    return 0;
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
    new Notice(`Initial sync failed: ${error}`);
    console.error("Initial sync failed:", error);
  });

  await cleanupOrphanedNodes(plugin);
};
