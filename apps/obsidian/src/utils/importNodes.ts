/* eslint-disable @typescript-eslint/naming-convention */
import { TFile } from "obsidian";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type DiscourseGraphPlugin from "~/index";
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import type { DiscourseNode, ImportableNode } from "~/types";
import generateUid from "~/utils/generateUid";
import { QueryEngine } from "~/services/QueryEngine";

export const getAvailableGroups = async (
  client: DGSupabaseClient,
): Promise<{ group_id: string }[]> => {
  const { data, error } = await client
    .from("group_membership")
    .select("group_id")
    .eq("member_id", (await client.auth.getUser()).data.user?.id || "");

  if (error) {
    console.error("Error fetching groups:", error);
    throw new Error(`Failed to fetch groups: ${error.message}`);
  }

  return data || [];
};

export const getPublishedNodesForGroups = async ({
  client,
  groupIds,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  groupIds: string[];
  currentSpaceId: number;
}): Promise<
  Array<{
    source_local_id: string;
    space_id: number;
    text: string;
    account_uid: string;
  }>
> => {
  if (groupIds.length === 0) {
    return [];
  }

  // First get all ResourceAccess entries for these groups
  const { data: resourceAccessData, error: raError } = await client
    .from("ResourceAccess")
    .select("source_local_id, space_id, account_uid")
    .in("account_uid", groupIds)
    .neq("space_id", currentSpaceId);

  if (raError) {
    console.error("Error fetching resource access:", raError);
    throw new Error(`Failed to fetch resource access: ${raError.message}`);
  }

  if (!resourceAccessData || resourceAccessData.length === 0) {
    return [];
  }

  // Group by space_id and source_local_id to fetch content efficiently
  const nodeKeys = new Set<string>();
  for (const ra of resourceAccessData) {
    if (ra.source_local_id && ra.space_id) {
      nodeKeys.add(`${ra.space_id}:${ra.source_local_id}`);
    }
  }

  // Group nodes by space_id for batched queries
  const nodesBySpace = new Map<number, Set<string>>();
  for (const key of nodeKeys) {
    const [spaceId, sourceLocalId] = key.split(":");
    const spaceIdNum = parseInt(spaceId || "0", 10);
    if (!nodesBySpace.has(spaceIdNum)) {
      nodesBySpace.set(spaceIdNum, new Set<string>());
    }
    nodesBySpace.get(spaceIdNum)!.add(sourceLocalId || "");
  }

  // Fetch Content with variant "direct" for all nodes, batched by space
  const nodes: Array<{
    source_local_id: string;
    space_id: number;
    text: string;
    account_uid: string;
  }> = [];

  for (const [spaceId, sourceLocalIds] of nodesBySpace.entries()) {
    const sourceLocalIdsArray = Array.from(sourceLocalIds);
    if (sourceLocalIdsArray.length === 0) {
      continue;
    }

    // Single query for all nodes in this space
    const { data: contentDataArray } = await client
      .from("Content")
      .select("source_local_id, text")
      .eq("space_id", spaceId)
      .eq("variant", "direct")
      .in("source_local_id", sourceLocalIdsArray);

    if (!contentDataArray || contentDataArray.length === 0) {
      continue;
    }

    // Create a map for quick lookup
    const contentMap = new Map<string, string>();
    for (const content of contentDataArray) {
      if (content.source_local_id && content.text) {
        contentMap.set(content.source_local_id, content.text);
      }
    }

    // Match content with ResourceAccess entries
    for (const ra of resourceAccessData) {
      if (
        ra.space_id === spaceId &&
        ra.source_local_id &&
        contentMap.has(ra.source_local_id)
      ) {
        nodes.push({
          source_local_id: ra.source_local_id,
          space_id: spaceId,
          text: contentMap.get(ra.source_local_id)!,
          account_uid: ra.account_uid,
        });
      }
    }
  }

  return nodes;
};

export const getLocalNodeInstanceIds = async (
  plugin: DiscourseGraphPlugin,
): Promise<Set<string>> => {
  const allFiles = plugin.app.vault.getMarkdownFiles();
  const nodeInstanceIds = new Set<string>();

  for (const file of allFiles) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    if (frontmatter?.nodeInstanceId) {
      nodeInstanceIds.add(frontmatter.nodeInstanceId as string);
    }
  }

  return nodeInstanceIds;
};

export const getSpaceName = async (
  client: DGSupabaseClient,
  spaceId: number,
): Promise<string> => {
  const { data, error } = await client
    .from("Space")
    .select("name")
    .eq("id", spaceId)
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching space name:", error);
    return `space-${spaceId}`;
  }

  return data.name;
};

export const getSpaceNames = async (
  client: DGSupabaseClient,
  spaceIds: number[],
): Promise<Map<number, string>> => {
  if (spaceIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("Space")
    .select("id, name")
    .in("id", spaceIds);

  if (error) {
    console.error("Error fetching space names:", error);
    return new Map();
  }

  const spaceMap = new Map<number, string>();
  (data || []).forEach((space) => {
    spaceMap.set(space.id, space.name);
  });

  return spaceMap;
};

export const fetchNodeContent = async ({
  client,
  spaceId,
  nodeInstanceId,
  variant,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  nodeInstanceId: string;
  variant: "direct" | "full";
}): Promise<string | null> => {
  const { data, error } = await client
    .from("Content")
    .select("text")
    .eq("source_local_id", nodeInstanceId)
    .eq("space_id", spaceId)
    .eq("variant", variant)
    .maybeSingle();

  if (error || !data) {
    console.error(
      `Error fetching node content (${variant}):`,
      error || "No data",
    );
    return null;
  }

  return data.text;
};

export const fetchNodeMetadata = async ({
  client,
  spaceId,
  nodeInstanceId,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  nodeInstanceId: string;
}): Promise<{ nodeTypeId?: string }> => {
  // Try to get nodeTypeId from Concept table
  const { data: conceptData } = await client
    .from("Concept")
    .select("literal_content")
    .eq("source_local_id", nodeInstanceId)
    .eq("space_id", spaceId)
    .eq("is_schema", false)
    .maybeSingle();

  return {
    nodeTypeId: (conceptData?.literal_content as unknown as { nodeTypeId?: string })?.nodeTypeId || undefined,
  };
};


const sanitizeFileName = (fileName: string): string => {
  // Remove invalid characters for file names
  return fileName
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

type ParsedFrontmatter = {
  nodeTypeId?: string;
  nodeInstanceId?: string;
  publishedToGroups?: string[];
  [key: string]: unknown;
};

const parseFrontmatter = (content: string): {
  frontmatter: ParsedFrontmatter;
  body: string;
} => {
  // Updated regex to handle files with only frontmatter (no body content)
  // The body is optional - it can be empty or not exist at all
  // Pattern: ---\n(frontmatter)\n---\n(body - optional)
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?$/;
  const match = content.match(frontmatterRegex);

  if (!match || !match[1]) {
    // No frontmatter, return empty frontmatter and full content as body
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = match[1];
  // Body is optional - if there's no body content, match[2] will be undefined
  const body = match[2] ?? "";

  // Parse YAML-like frontmatter (simple parser for key: value pairs)
  const frontmatter: ParsedFrontmatter = {};
  const lines = frontmatterText.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const colonIndex = trimmed.indexOf(":");
    if (colonIndex === -1) continue;

    const key = trimmed.slice(0, colonIndex).trim();
    const valueStr = trimmed.slice(colonIndex + 1).trim();
    let value: unknown = valueStr;

    // Handle array values: inline (valueStr starts with "-") or block (valueStr empty, next lines start with "-")
    const isInlineArrayStart = valueStr.startsWith("-");
    const isEmptyValue = !valueStr || valueStr.trim() === "";

    if (isInlineArrayStart || isEmptyValue) {
      const arrayValues: string[] = [];
      let nextLineIndex = i + 1;

      // First item on same line (inline): "key: - item"
      if (isInlineArrayStart) {
        const firstItem = valueStr.slice(1).trim();
        if (firstItem) arrayValues.push(firstItem);
      }

      // Collect array items from subsequent lines that trim-start with "-"
      let currentLine: string | undefined =
        nextLineIndex < lines.length ? lines[nextLineIndex] : undefined;
      while (currentLine != null && currentLine.trim().startsWith("-")) {
        const itemValue = currentLine.trim().slice(1).trim();
        if (itemValue) arrayValues.push(itemValue);
        nextLineIndex++;
        currentLine =
          nextLineIndex < lines.length ? lines[nextLineIndex] : undefined;
      }

      value =
        arrayValues.length > 0
          ? arrayValues
          : isInlineArrayStart
            ? [valueStr.slice(1).trim()]
            : [];
      frontmatter[key] = value;
      i = nextLineIndex - 1; // skip consumed lines
      continue;
    }

    // Scalar value: remove quotes if present
    if (
      (valueStr.startsWith('"') && valueStr.endsWith('"')) ||
      (valueStr.startsWith("'") && valueStr.endsWith("'"))
    ) {
      value = valueStr.slice(1, -1);
    } else {
      value = valueStr;
    }

    frontmatter[key] = value;
  }

  return { frontmatter, body };
};

/**
 * Parse literal_content from a Concept schema into fields for DiscourseNode.
 * Handles both nested form { label, template, source_data: { format, color, tag } }
 * and flat form { id, name, color, format, tag }.
 */
const parseSchemaLiteralContent = (
  literalContent: unknown,
  fallbackName: string,
): Pick<DiscourseNode, "name" | "format" | "color" | "tag" | "template" | "keyImage"> => {
  const obj =
    typeof literalContent === "string"
      ? (JSON.parse(literalContent) as Record<string, unknown>)
      : (literalContent as Record<string, unknown>) || {};
  const src = (obj.source_data as Record<string, unknown>) || obj;
  const name = (obj.name as string) || (obj.label as string) || fallbackName;
  const formatFromSchema =
    (src.format as string) || (obj.format as string) || "";
  const format =
    formatFromSchema ||
    `${name.slice(0, 3).toUpperCase()} - {content}`;
  return {
    name,
    format,
    color: (src.color as string) || (obj.color as string) || undefined,
    tag: (src.tag as string) || (obj.tag as string) || undefined,
    template: (obj.template as string) || undefined,
    keyImage: (src.keyImage as boolean) ?? (obj.keyImage as boolean) ?? undefined,
  };
};

const mapNodeTypeIdToLocal = async ({
  plugin,
  client,
  sourceSpaceId,
  sourceNodeTypeId,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  sourceSpaceId: number;
  sourceNodeTypeId: string;
}): Promise<string> => {
  // Find the schema in the source space with this nodeTypeId
  const { data: schemaData } = await client
    .from("Concept")
    .select("name, literal_content")
    .eq("space_id", sourceSpaceId)
    .eq("is_schema", true)
    .eq("source_local_id", sourceNodeTypeId)
    .maybeSingle();

  if (!schemaData?.name) {
    return sourceNodeTypeId;
  }

  const schemaName = schemaData.name;

  // Find a local nodeType with the same name (use plugin.settings so we see newly created types)
  const matchingLocalNodeType = plugin.settings.nodeTypes.find(
    (nt) => nt.name === schemaName,
  );

  if (matchingLocalNodeType) {
    return matchingLocalNodeType.id;
  }

  // No matching local nodeType: create one from literal_content and add to settings
  const parsed = parseSchemaLiteralContent(
    schemaData.literal_content,
    schemaName,
  );

  const newNodeType: DiscourseNode = {
    id: generateUid("node"),
    name: parsed.name,
    format: parsed.format,
    color: parsed.color,
    tag: parsed.tag,
    template: parsed.template,
    keyImage: parsed.keyImage,
  };
  plugin.settings.nodeTypes = [
    ...plugin.settings.nodeTypes,
    newNodeType,
  ];
  await plugin.saveSettings();
  return newNodeType.id;
};

const processFileContent = async ({
  plugin,
  client,
  sourceSpaceId,
  rawContent,
  filePath,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  sourceSpaceId: number;
  rawContent: string;
  filePath: string;
}): Promise<{ file: TFile; error?: string }> => {
  // 1. Create or update the file with the fetched content first
  let file: TFile | null = plugin.app.vault.getFileByPath(filePath);
  if (!file) {
    file = await plugin.app.vault.create(filePath, rawContent);
  } else {
    await plugin.app.vault.modify(file, rawContent);
  }

  // 2. Parse frontmatter from rawContent (metadataCache is updated async and is
  //    often empty immediately after create/modify), then map nodeTypeId and  update frontmatter.
  const { frontmatter } = parseFrontmatter(rawContent);
  const sourceNodeTypeId = frontmatter.nodeTypeId as string | undefined;

  let mappedNodeTypeId: string | undefined;
  if (sourceNodeTypeId && typeof sourceNodeTypeId === "string") {
    mappedNodeTypeId = await mapNodeTypeIdToLocal({
      plugin,
      client,
      sourceSpaceId,
      sourceNodeTypeId,
    });
  }

  await plugin.app.fileManager.processFrontMatter(file, (fm) => {
    if (mappedNodeTypeId !== undefined) {
      (fm as Record<string, unknown>).nodeTypeId = mappedNodeTypeId;
    }
    (fm as Record<string, unknown>).importedFromSpaceId = sourceSpaceId;
  });

  return { file };
};

export const importSelectedNodes = async ({
  plugin,
  selectedNodes,
  onProgress,
}: {
  plugin: DiscourseGraphPlugin;
  selectedNodes: ImportableNode[];
  onProgress?: (current: number, total: number) => void;
}): Promise<{ success: number; failed: number }> => {
  const client = await getLoggedInClient(plugin);
  if (!client) {
    throw new Error("Cannot get Supabase client");
  }

  const context = await getSupabaseContext(plugin);
  if (!context) {
    throw new Error("Cannot get Supabase context");
  }

  const queryEngine = new QueryEngine(plugin.app);

  let successCount = 0;
  let failedCount = 0;
  let processedCount = 0;
  const totalNodes = selectedNodes.length;

  // Group nodes by space to create folders efficiently
  const nodesBySpace = new Map<number, ImportableNode[]>();
  for (const node of selectedNodes) {
    if (!nodesBySpace.has(node.spaceId)) {
      nodesBySpace.set(node.spaceId, []);
    }
    nodesBySpace.get(node.spaceId)!.push(node);
  }

  // Process each space
  for (const [spaceId, nodes] of nodesBySpace.entries()) {
    const spaceName = await getSpaceName(client, spaceId);
    const importFolderPath = `import/${sanitizeFileName(spaceName)}`;

    // Ensure the folder exists
    const folderExists =
      await plugin.app.vault.adapter.exists(importFolderPath);
    if (!folderExists) {
      await plugin.app.vault.createFolder(importFolderPath);
    }

    // Process each node in this space
    for (const node of nodes) {
      try {
        // Check if file already exists by nodeInstanceId + importedFromSpaceId
        const existingFile = queryEngine.findExistingImportedFile(
          node.nodeInstanceId,
          node.spaceId,
        );

        console.log("existingFile", existingFile);

        // Fetch the file name (direct variant) and content (full variant)
        const fileName = await fetchNodeContent({
          client,
          spaceId: node.spaceId,
          nodeInstanceId: node.nodeInstanceId,
          variant: "direct",
        });

        if (!fileName) {
          console.warn(
            `No direct variant found for node ${node.nodeInstanceId}`,
          );
          failedCount++;
          processedCount++;
          onProgress?.(processedCount, totalNodes);
          continue;
        }

        const content = await fetchNodeContent({
          client,
          spaceId: node.spaceId,
          nodeInstanceId: node.nodeInstanceId,
          variant: "full",
        });

        if (content === null) {
          console.warn(`No full variant found for node ${node.nodeInstanceId}`);
          failedCount++;
          processedCount++;
          onProgress?.(processedCount, totalNodes);
          continue;
        }

        // Sanitize file name
        const sanitizedFileName = sanitizeFileName(fileName);
        let finalFilePath: string;

        if (existingFile) {
          // Update existing file - use its current path
          finalFilePath = existingFile.path;
        } else {
          // Create new file in the import folder
          finalFilePath = `${importFolderPath}/${sanitizedFileName}.md`;

          // Check if file path already exists (edge case: same title but different nodeInstanceId)
          let counter = 1;
          while (await plugin.app.vault.adapter.exists(finalFilePath)) {
            finalFilePath = `${importFolderPath}/${sanitizedFileName} (${counter}).md`;
            counter++;
          }
        }

        // Process the file content (maps nodeTypeId, handles frontmatter)
        // This updates existing file or creates new one
        const result = await processFileContent({
          plugin,
          client,
          sourceSpaceId: node.spaceId,
          rawContent: content,
          filePath: finalFilePath,
        });

        if (result.error) {
          console.error(
            `Error processing file content for node ${node.nodeInstanceId}:`,
            result.error,
          );
          failedCount++;
          processedCount++;
          onProgress?.(processedCount, totalNodes);
          continue;
        }

        // If title changed and file exists, rename it to match the new title
        const processedFile = result.file;
        if (existingFile && processedFile.basename !== sanitizedFileName) {
          const newPath = `${importFolderPath}/${sanitizedFileName}.md`;
          let targetPath = newPath;
          let counter = 1;
          while (await plugin.app.vault.adapter.exists(targetPath)) {
            targetPath = `${importFolderPath}/${sanitizedFileName} (${counter}).md`;
            counter++;
          }
          await plugin.app.fileManager.renameFile(processedFile, targetPath);
        }

        successCount++;
        processedCount++;
        onProgress?.(processedCount, totalNodes);
      } catch (error) {
        console.error(`Error importing node ${node.nodeInstanceId}:`, error);
        failedCount++;
        processedCount++;
        onProgress?.(processedCount, totalNodes);
      }
    }
  }

  return { success: successCount, failed: failedCount };
};

/**
 * Refresh a single imported file by fetching the latest content from the database
 * Reuses the same logic as importSelectedNodes by treating it as a single-node import
 */
export const refreshImportedFile = async ({
  plugin,
  file,
  client,
}: {
  plugin: DiscourseGraphPlugin;
  file: TFile;
  client?: DGSupabaseClient;
}): Promise<{ success: boolean; error?: string }> => {
  const supabaseClient = client || await getLoggedInClient(plugin);
  if (!supabaseClient) {
    throw new Error("Cannot get Supabase client");
  }
  const cache = plugin.app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter as Record<string, unknown>;
  if (
    !frontmatter.importedFromSpaceId ||
    !frontmatter.nodeInstanceId ||
    !frontmatter.publishedToGroups
  ) {
    return {
      success: false,
      error:
        "Missing frontmatter: importedFromSpaceId or nodeInstanceId or publishedToGroups",
    };
  }
  const spaceName = await getSpaceName(
    supabaseClient,
    frontmatter.importedFromSpaceId as number,
  );
  const result = await importSelectedNodes({
    plugin,
    selectedNodes: [
      {
        nodeInstanceId: frontmatter.nodeInstanceId as string,
        title: file.basename,
        spaceId: frontmatter.importedFromSpaceId as number,
        spaceName: spaceName,
        groupId: (frontmatter.publishedToGroups as string[])[0] ?? "",
        selected: false,
      },
    ],
  });
  return { success: result.success > 0, error: result.failed > 0 ? "Failed to refresh imported file" : undefined };
};

/**
 * Refresh all imported files in the vault
 */
export const refreshAllImportedFiles = async (
  plugin: DiscourseGraphPlugin,
): Promise<{ success: number; failed: number; errors: Array<{ file: string; error: string }> }> => {
  const allFiles = plugin.app.vault.getMarkdownFiles();
  const importedFiles: TFile[] = [];
  const client = await getLoggedInClient(plugin);
  if (!client) {
    throw new Error("Cannot get Supabase client");
  }
  // Find all imported files
  for (const file of allFiles) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (frontmatter?.importedFromSpaceId && frontmatter?.nodeInstanceId) {
      importedFiles.push(file);
    }
  }

  if (importedFiles.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  let successCount = 0;
  let failedCount = 0;
  const errors: Array<{ file: string; error: string }> = [];

  // Refresh each file
  for (const file of importedFiles) {
    const result = await refreshImportedFile({ plugin, file, client });
    if (result.success) {
      successCount++;
    } else {
      failedCount++;
      errors.push({
        file: file.path,
        error: result.error || "Unknown error",
      });
    }
  }

  return { success: successCount, failed: failedCount, errors };
};
