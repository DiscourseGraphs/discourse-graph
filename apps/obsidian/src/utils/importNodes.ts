/* eslint-disable @typescript-eslint/naming-convention */
import { App, TFile } from "obsidian";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type DiscourseGraphPlugin from "~/index";
import { getLoggedInClient, getSupabaseContext } from "./supabaseContext";
import type { DiscourseNode, ImportableNode } from "~/types";
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

export const getLocalNodeInstanceIds = (
  plugin: DiscourseGraphPlugin,
): Set<string> => {
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

const fetchFileReferences = async ({
  client,
  spaceId,
  nodeInstanceId,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  nodeInstanceId: string;
}): Promise<
  Array<{
    filepath: string;
    filehash: string;
    created: string;
    last_modified: string;
  }>
> => {
  const { data, error } = await client
    .from("FileReference")
    .select("filepath, filehash, created, last_modified")
    .eq("space_id", spaceId)
    .eq("source_local_id", nodeInstanceId);

  if (error) {
    console.error("Error fetching file references:", error);
    return [];
  }

  return data || [];
};

const downloadFileFromStorage = async ({
  client,
  filehash,
}: {
  client: DGSupabaseClient;
  filehash: string;
}): Promise<ArrayBuffer | null> => {
  try {
    const { data, error } = await client.storage
      .from("assets")
      .download(filehash);

    if (error) {
      console.warn(`Error downloading file ${filehash}:`, error);
      return null;
    }

    if (!data) {
      console.warn(`No data returned for file ${filehash}`);
      return null;
    }

    return await data.arrayBuffer();
  } catch (error) {
    console.error(`Exception downloading file ${filehash}:`, error);
    return null;
  }
};

const extractFileName = (filepath: string): { name: string; ext: string } => {
  // Handle paths like "attachments/image.png" or "folder/subfolder/file.jpg"
  // Extract just the filename with extension
  const parts = filepath.split("/");
  const fileName = parts[parts.length - 1] || filepath;

  // Split filename and extension
  const lastDotIndex = fileName.lastIndexOf(".");
  if (lastDotIndex === -1 || lastDotIndex === fileName.length - 1) {
    // No extension or extension is empty
    return { name: fileName, ext: "" };
  }

  const name = fileName.slice(0, lastDotIndex);
  const ext = fileName.slice(lastDotIndex + 1);

  return { name, ext };
};

const updateMarkdownAssetLinks = ({
  content,
  oldPathToNewPath,
  targetFile,
  app,
}: {
  content: string;
  oldPathToNewPath: Map<string, string>;
  targetFile: TFile;
  app: App;
}): string => {
  if (oldPathToNewPath.size === 0) {
    return content;
  }

  // Create a set of all new paths for quick lookup
  const newPaths = new Set(oldPathToNewPath.values());

  // Create a map of old paths to new files for quick lookup
  const oldPathToNewFile = new Map<string, TFile>();
  for (const [oldPath, newPath] of oldPathToNewPath.entries()) {
    const newFile = app.metadataCache.getFirstLinkpathDest(
      newPath,
      targetFile.path,
    );
    if (newFile) {
      oldPathToNewFile.set(oldPath, newFile);
    }
  }

  let updatedContent = content;

  // Helper to check if a link path matches an old path
  const matchesOldPath = (linkPath: string, oldPath: string): boolean => {
    // Exact match
    if (linkPath === oldPath) return true;

    // Match by filename (handles relative paths)
    const oldFileName = extractFileName(oldPath);
    const linkFileName = extractFileName(linkPath);
    if (
      oldFileName.name === linkFileName.name &&
      oldFileName.ext === linkFileName.ext
    ) {
      return true;
    }

    // Match if linkPath ends with oldPath or vice versa (handles relative vs absolute)
    if (linkPath.endsWith(oldPath) || oldPath.endsWith(linkPath)) {
      return true;
    }

    return false;
  };

  // Helper to find file for a link path, checking if it's one of our imported assets
  const findImportedAssetFile = (linkPath: string): TFile | null => {
    // Try to resolve the link
    const resolvedFile = app.metadataCache.getFirstLinkpathDest(
      linkPath,
      targetFile.path,
    );

    if (resolvedFile && newPaths.has(resolvedFile.path)) {
      // This file is one of our imported assets
      return resolvedFile;
    }

    // Also check if the resolved file is in an assets folder (user may have renamed it)
    if (resolvedFile && resolvedFile.path.includes("/assets/")) {
      // Check if any of our new files match this one (by checking if path is similar)
      for (const newPath of newPaths) {
        const newFile = app.metadataCache.getFirstLinkpathDest(
          newPath,
          targetFile.path,
        );
        if (newFile && newFile.path === resolvedFile.path) {
          return resolvedFile;
        }
      }
    }

    return null;
  };

  // Match wiki links: [[path]] or [[path|alias]]
  const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
  updatedContent = updatedContent.replace(wikiLinkRegex, (match, linkContent) => {
    // Extract path and optional alias
    const [linkPath, alias] = linkContent.split("|").map((s: string) => s.trim());

    // Skip external URLs
    if (linkPath.startsWith("http://") || linkPath.startsWith("https://")) {
      return match;
    }

    // First, try to find if this link resolves to one of our imported assets
    const importedAssetFile = findImportedAssetFile(linkPath);
    if (importedAssetFile) {
      const linkText = app.metadataCache.fileToLinktext(
        importedAssetFile,
        targetFile.path,
      );
      if (alias) {
        return `[[${linkText}|${alias}]]`;
      }
      return `[[${linkText}]]`;
    }

    // Fallback: Find matching old path
    for (const [oldPath, newFile] of oldPathToNewFile.entries()) {
      if (matchesOldPath(linkPath, oldPath)) {
        const linkText = app.metadataCache.fileToLinktext(newFile, targetFile.path);
        if (alias) {
          return `[[${linkText}|${alias}]]`;
        }
        return `[[${linkText}]]`;
      }
    }

    return match;
  });

  // Match markdown image links: ![alt](path) or ![alt](path "title")
  const markdownImageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  updatedContent = updatedContent.replace(
    markdownImageRegex,
    (match, alt, linkPath) => {
      // Remove optional title from linkPath: "path" or "path title"
      const cleanPath = linkPath.replace(/\s+"[^"]*"$/, "").trim();

      // Skip external URLs
      if (cleanPath.startsWith("http://") || cleanPath.startsWith("https://")) {
        return match;
      }

      // First, try to find if this link resolves to one of our imported assets
      const importedAssetFile = findImportedAssetFile(cleanPath);
      if (importedAssetFile) {
        const linkText = app.metadataCache.fileToLinktext(
          importedAssetFile,
          targetFile.path,
        );
        return `![${alt}](${linkText})`;
      }

      // Fallback: Find matching old path
      for (const [oldPath, newFile] of oldPathToNewFile.entries()) {
        if (matchesOldPath(cleanPath, oldPath)) {
          const linkText = app.metadataCache.fileToLinktext(newFile, targetFile.path);
          return `![${alt}](${linkText})`;
        }
      }

      return match;
    },
  );

  return updatedContent;
};


const importAssetsForNode = async ({
  plugin,
  client,
  spaceId,
  nodeInstanceId,
  spaceName,
  targetMarkdownFile,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  spaceId: number;
  nodeInstanceId: string;
  spaceName: string;
  targetMarkdownFile: TFile;
}): Promise<{
  success: boolean;
  pathMapping: Map<string, string>; // old path -> new path
  errors: string[];
}> => {
  const pathMapping = new Map<string, string>();
  const errors: string[] = [];

  // Fetch FileReference records for the node
  const fileReferences = await fetchFileReferences({
    client,
    spaceId,
    nodeInstanceId,
  });

  if (fileReferences.length === 0) {
    return { success: true, pathMapping, errors };
  }

  const importFolderPath = `import/${sanitizeFileName(spaceName)}`;
  const assetsFolderPath = `${importFolderPath}/assets`;

  // Ensure assets folder exists
  const assetsFolderExists =
    await plugin.app.vault.adapter.exists(assetsFolderPath);
  if (!assetsFolderExists) {
    await plugin.app.vault.createFolder(assetsFolderPath);
  }

  // Get existing asset mappings from frontmatter
  const cache = plugin.app.metadataCache.getFileCache(targetMarkdownFile);
  const frontmatter = (cache?.frontmatter as Record<string, unknown>) || {};
  const importedAssetsRaw = frontmatter.importedAssets;
  const importedAssets: Record<string, string> =
    importedAssetsRaw && typeof importedAssetsRaw === "object" && !Array.isArray(importedAssetsRaw)
      ? (importedAssetsRaw as Record<string, string>)
      : {};
  // importedAssets format: { filehash: vaultPath }

  // Process each file reference
  for (const fileRef of fileReferences) {
    try {
      const { filepath, filehash } = fileRef;
      const { name, ext } = extractFileName(filepath);

      // Check if we already have a file for this hash
      let existingAssetPath: string | undefined = importedAssets[filehash];
      let existingFile: TFile | null = null;

      if (existingAssetPath) {
        // Check if the file still exists at the stored path
        const file = plugin.app.vault.getAbstractFileByPath(existingAssetPath);
        if (file && file instanceof TFile) {
          existingFile = file;
        } else {
          // File was moved/renamed - search for it in the assets folder
          // Try to find a file with the same name in the assets folder
          const { name: fileName, ext: fileExt } = extractFileName(existingAssetPath);
          const searchFileName = `${fileName}${fileExt ? `.${fileExt}` : ""}`;

          // Search all files in the assets folder
          const allFiles = plugin.app.vault.getFiles();
          for (const vaultFile of allFiles) {
            if (
              vaultFile instanceof TFile &&
              vaultFile.path.startsWith(assetsFolderPath) &&
              vaultFile.basename === fileName &&
              vaultFile.extension === fileExt
            ) {
              // Found a file with matching name in assets folder - likely the same file
              existingFile = vaultFile;
              existingAssetPath = vaultFile.path;
              // Update frontmatter with new path
              await plugin.app.fileManager.processFrontMatter(
                targetMarkdownFile,
                (fm) => {
                  const assetsRaw = (fm as Record<string, unknown>).importedAssets;
                  const assets: Record<string, string> =
                    assetsRaw && typeof assetsRaw === "object" && !Array.isArray(assetsRaw)
                      ? (assetsRaw as Record<string, string>)
                      : {};
                  assets[filehash] = vaultFile.path;
                  (fm as Record<string, unknown>).importedAssets = assets;
                },
              );
              break;
            }
          }
        }
      }

      // If we found an existing file, reuse it
      if (existingFile) {
        pathMapping.set(filepath, existingFile.path);
        console.log(`Reusing existing asset: ${filehash} -> ${existingFile.path}`);
        continue;
      }

      // No existing file found, need to download
      // Determine target path
      const sanitizedName = sanitizeFileName(name);
      const sanitizedExt = ext ? `.${ext}` : "";
      const sanitizedFileName = `${sanitizedName}${sanitizedExt}`;
      let targetPath = `${assetsFolderPath}/${sanitizedFileName}`;

      // Check if file already exists at target path (avoid duplicates)
      if (await plugin.app.vault.adapter.exists(targetPath)) {
        // File exists at expected path, reuse it
        const file = plugin.app.vault.getAbstractFileByPath(targetPath);
        if (file && file instanceof TFile) {
          pathMapping.set(filepath, targetPath);
          // Update frontmatter to track this mapping
          await plugin.app.fileManager.processFrontMatter(
            targetMarkdownFile,
            (fm) => {
              const assetsRaw = (fm as Record<string, unknown>).importedAssets;
              const assets: Record<string, string> =
                assetsRaw && typeof assetsRaw === "object" && !Array.isArray(assetsRaw)
                  ? (assetsRaw as Record<string, string>)
                  : {};
              assets[filehash] = targetPath;
              (fm as Record<string, unknown>).importedAssets = assets;
            },
          );
          console.log(`Reusing existing file at path: ${targetPath}`);
          continue;
        }
      }

      // File doesn't exist, download it
      const fileContent = await downloadFileFromStorage({
        client,
        filehash,
      });

      if (!fileContent) {
        errors.push(`Failed to download file: ${filepath}`);
        console.warn(`Failed to download file ${filepath} (hash: ${filehash})`);
        continue;
      }

      // Save file to vault
      await plugin.app.vault.createBinary(targetPath, fileContent);

      // Update frontmatter to track this mapping
      await plugin.app.fileManager.processFrontMatter(targetMarkdownFile, (fm) => {
        const assetsRaw = (fm as Record<string, unknown>).importedAssets;
        const assets: Record<string, string> =
          assetsRaw && typeof assetsRaw === "object" && !Array.isArray(assetsRaw)
            ? (assetsRaw as Record<string, string>)
            : {};
        assets[filehash] = targetPath;
        (fm as Record<string, unknown>).importedAssets = assets;
      });

      // Track path mapping
      pathMapping.set(filepath, targetPath);
      console.log(`Imported asset: ${filepath} -> ${targetPath}`);
    } catch (error) {
      const errorMsg = `Error importing asset ${fileRef.filepath}: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg, error);
    }
  }

  return {
    success: errors.length === 0 || pathMapping.size > 0,
    pathMapping,
    errors,
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

const parseFrontmatter = (
  content: string,
): {
  frontmatter: ParsedFrontmatter;
  body: string;
} => {
  // Pattern: ---\n(frontmatter)\n---\n(body - optional)
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*(?:\n([\s\S]*))?$/;
  const match = content.match(frontmatterRegex);

  if (!match || !match[1]) {
    return { frontmatter: {}, body: content };
  }

  const frontmatterText = match[1];
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

  const now = new Date().getTime();

  const newNodeType: DiscourseNode = {
    id: sourceNodeTypeId,
    name: parsed.name,
    format: parsed.format,
    color: parsed.color,
    tag: parsed.tag,
    template: parsed.template,
    keyImage: parsed.keyImage,
    created: now,
    modified: now,
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
  const sourceNodeTypeId = frontmatter.nodeTypeId;

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
    const assetsFolderPath = `${importFolderPath}/assets`;

    // Ensure the import folder exists
    const folderExists =
      await plugin.app.vault.adapter.exists(importFolderPath);
    if (!folderExists) {
      await plugin.app.vault.createFolder(importFolderPath);
    }

    // Ensure the assets folder exists
    const assetsFolderExists =
      await plugin.app.vault.adapter.exists(assetsFolderPath);
    if (!assetsFolderExists) {
      await plugin.app.vault.createFolder(assetsFolderPath);
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

        const processedFile = result.file;

        // Import assets for this node
        const assetImportResult = await importAssetsForNode({
          plugin,
          client,
          spaceId: node.spaceId,
          nodeInstanceId: node.nodeInstanceId,
          spaceName,
          targetMarkdownFile: processedFile,
        });

        // Update markdown content with new asset paths if assets were imported
        if (assetImportResult.pathMapping.size > 0) {
          const currentContent = await plugin.app.vault.read(processedFile);
          const updatedContent = updateMarkdownAssetLinks({
            content: currentContent,
            oldPathToNewPath: assetImportResult.pathMapping,
            targetFile: processedFile,
            app: plugin.app,
          });

          // Only update if content changed
          if (updatedContent !== currentContent) {
            await plugin.app.vault.modify(processedFile, updatedContent);
          }
        }

        // Log asset import errors if any
        if (assetImportResult.errors.length > 0) {
          console.warn(
            `Some assets failed to import for node ${node.nodeInstanceId}:`,
            assetImportResult.errors,
          );
        }

        // If title changed and file exists, rename it to match the new title
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
  if (!frontmatter.importedFromSpaceId || !frontmatter.nodeInstanceId) {
    return {
      success: false,
      error: "Missing frontmatter: importedFromSpaceId or nodeInstanceId",
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
