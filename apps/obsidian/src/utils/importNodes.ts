/* eslint-disable @typescript-eslint/naming-convention */
import matter from "gray-matter";
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
    createdAt: number;
    modifiedAt: number;
  }>
> => {
  if (groupIds.length === 0) {
    return [];
  }

  // Query my_contents (RLS applied); exclude current space. Get both variants so we can use
  // the latest last_modified per node and prefer "direct" for text (title).
  const { data, error } = await client
    .from("my_contents")
    .select("source_local_id, space_id, text, created, last_modified, variant")
    .neq("space_id", currentSpaceId);

  if (error) {
    console.error("Error fetching published nodes:", error);
    throw new Error(`Failed to fetch published nodes: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  type Row = {
    source_local_id: string | null;
    space_id: number | null;
    text: string | null;
    created: string | null;
    last_modified: string | null;
    variant: string | null;
  };

  const key = (r: Row) => `${r.space_id ?? ""}\t${r.source_local_id ?? ""}`;
  const groups = new Map<string, Row[]>();
  for (const row of data as Row[]) {
    if (row.source_local_id == null || row.space_id == null) continue;
    const k = key(row);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }

  const nodes: Array<{
    source_local_id: string;
    space_id: number;
    text: string;
    createdAt: number;
    modifiedAt: number;
  }> = [];

  for (const rows of groups.values()) {
    const withDate = rows.filter(
      (r) => r.last_modified != null && r.text != null,
    );
    if (withDate.length === 0) continue;
    const latest = withDate.reduce((a, b) =>
      (a.last_modified ?? "") >= (b.last_modified ?? "") ? a : b,
    );
    const direct = rows.find((r) => r.variant === "direct");
    const text = direct?.text ?? latest.text ?? "";
    const createdAt = latest.created
      ? new Date(latest.created + "Z").valueOf()
      : 0;
    const modifiedAt = latest.last_modified
      ? new Date(latest.last_modified + "Z").valueOf()
      : 0;
    nodes.push({
      source_local_id: latest.source_local_id!,
      space_id: latest.space_id!,
      text,
      createdAt,
      modifiedAt,
    });
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

export const getSpaceNameFromId = async (
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

export const getSpaceNameIdFromUri = async (
  client: DGSupabaseClient,
  spaceUri: string,
): Promise<{ spaceName: string; spaceId: number }> => {
  const { data, error } = await client
    .from("Space")
    .select("name, id")
    .eq("url", spaceUri)
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching space name:", error);
    return { spaceName: "", spaceId: -1 };
  }

  return { spaceName: data.name, spaceId: data.id };
};

export const getSpaceNameFromIds = async (
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

export const getSpaceUris = async (
  client: DGSupabaseClient,
  spaceIds: number[],
): Promise<Map<number, string>> => {
  if (spaceIds.length === 0) {
    return new Map();
  }

  const { data, error } = await client
    .from("Space")
    .select("id, url")
    .in("id", spaceIds);

  if (error) {
    console.error("Error fetching space urls:", error);
    return new Map();
  }

  const spaceMap = new Map<number, string>();
  (data || []).forEach((space) => {
    spaceMap.set(space.id, space.url);
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
    .from("my_contents")
    .select("text")
    .eq("source_local_id", nodeInstanceId)
    .eq("space_id", spaceId)
    .eq("variant", variant)
    .maybeSingle();

  if (error || !data || data.text == null) {
    console.error(
      `Error fetching node content (${variant}):`,
      error || "No data",
    );
    return null;
  }

  return data.text;
};

export const fetchNodeContentWithMetadata = async ({
  client,
  spaceId,
  nodeInstanceId,
  variant,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  nodeInstanceId: string;
  variant: "direct" | "full";
}): Promise<{
  content: string;
  createdAt: number;
  modifiedAt: number;
} | null> => {
  const { data, error } = await client
    .from("my_contents")
    .select("text, created, last_modified")
    .eq("source_local_id", nodeInstanceId)
    .eq("space_id", spaceId)
    .eq("variant", variant)
    .maybeSingle();

  if (error || !data || data.text == null) {
    console.error(
      `Error fetching node content with metadata (${variant}):`,
      error || "No data",
    );
    return null;
  }

  return {
    content: data.text,
    createdAt: new Date(data.created ?? 0).valueOf(),
    modifiedAt: new Date(data.last_modified ?? 0).valueOf(),
  };
};

/**
 * Fetches created/last_modified from the source space Content (my_contents) for an imported node.
 * Used by the discourse context view to show "last modified in original vault".
 */
export const getSourceContentDates = async ({
  plugin,
  nodeInstanceId,
  spaceUri,
}: {
  plugin: DiscourseGraphPlugin;
  nodeInstanceId: string;
  spaceUri: string;
}): Promise<{ createdAt: string; modifiedAt: string } | null> => {
  const client = await getLoggedInClient(plugin);
  if (!client) return null;
  const { spaceId } = await getSpaceNameIdFromUri(client, spaceUri);
  if (spaceId < 0) return null;
  const { data, error } = await client
    .from("my_contents")
    .select("created, last_modified")
    .eq("source_local_id", nodeInstanceId)
    .eq("space_id", spaceId)
    .eq("variant", "direct")
    .maybeSingle();
  if (error || !data) return null;
  return {
    createdAt: data.created ?? new Date(0).toISOString(),
    modifiedAt: data.last_modified ?? new Date(0).toISOString(),
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
    created: number;
    last_modified: number;
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

  return data.map(({ filepath, filehash, created, last_modified }) => ({
    filepath,
    filehash,
    created: created ? new Date(created + "Z").valueOf() : 0,
    last_modified: last_modified ? new Date(last_modified + "Z").valueOf() : 0,
  }));
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

  // Normalize path for comparison: strip leading "./", collapse repeated slashes.
  // We match only by full path (exact after normalizing), not by filename alone,
  // so that different paths with the same name (e.g. experiment1/result.jpg vs
  // experiment2/result.jpg) are never treated as the same asset.
  const normalizePathForMatch = (p: string): string =>
    p.replace(/^\.\//, "").replace(/\/+/g, "/").trim();

  const matchesOldPath = (linkPath: string, oldPath: string): boolean =>
    normalizePathForMatch(linkPath) === normalizePathForMatch(oldPath);

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
  updatedContent = updatedContent.replace(
    wikiLinkRegex,
    (match, linkContent) => {
      // Extract path and optional alias
      const [linkPath, alias] = linkContent
        .split("|")
        .map((s: string) => s.trim());

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
          const linkText = app.metadataCache.fileToLinktext(
            newFile,
            targetFile.path,
          );
          if (alias) {
            return `[[${linkText}|${alias}]]`;
          }
          return `[[${linkText}]]`;
        }
      }

      return match;
    },
  );

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
          const linkText = app.metadataCache.fileToLinktext(
            newFile,
            targetFile.path,
          );
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
  const stat = {
    ctime: targetMarkdownFile.stat.ctime,
    mtime: targetMarkdownFile.stat.mtime,
  };

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
    importedAssetsRaw &&
    typeof importedAssetsRaw === "object" &&
    !Array.isArray(importedAssetsRaw)
      ? (importedAssetsRaw as Record<string, string>)
      : {};
  // importedAssets format: { filehash: vaultPath }

  // Process each file reference
  for (const fileRef of fileReferences) {
    try {
      const { filepath, filehash } = fileRef;
      const { name, ext } = extractFileName(filepath);

      // Check if we already have a file for this hash
      const existingAssetPath: string | undefined = importedAssets[filehash];
      let existingFile: TFile | null = null;

      if (existingAssetPath) {
        // Check if the file still exists at the stored path
        const file = plugin.app.vault.getAbstractFileByPath(existingAssetPath);
        if (file && file instanceof TFile) {
          existingFile = file;
        }
      }

      let overwritePath: string | undefined;
      if (existingFile) {
        const refLastModifiedMs = fileRef.last_modified
          ? new Date(fileRef.last_modified + "Z").getTime()
          : 0;
        const localModifiedAfterRef =
          refLastModifiedMs > 0 && existingFile.stat.mtime > refLastModifiedMs;
        if (!localModifiedAfterRef) {
          pathMapping.set(filepath, existingFile.path);
          console.log(
            `Reusing existing asset: ${filehash} -> ${existingFile.path}`,
          );
          continue;
        }
        overwritePath = existingFile.path;
      }

      // Determine target path (new file or overwrite of modified local file)
      const sanitizedName = sanitizeFileName(name);
      const sanitizedExt = ext ? `.${ext}` : "";
      const sanitizedFileName = `${sanitizedName}${sanitizedExt}`;
      const targetPath =
        overwritePath ?? `${assetsFolderPath}/${sanitizedFileName}`;

      // If local mtime is newer than fileRef.last_modified, overwrite with DB version.
      if (await plugin.app.vault.adapter.exists(targetPath)) {
        const file = plugin.app.vault.getAbstractFileByPath(targetPath);
        if (file && file instanceof TFile) {
          const localMtimeMs = file.stat.mtime;
          const refLastModifiedMs = fileRef.last_modified
            ? new Date(fileRef.last_modified + "Z").getTime()
            : 0;
          const localModifiedAfterRef =
            refLastModifiedMs > 0 && localMtimeMs > refLastModifiedMs;
          if (!localModifiedAfterRef) {
            pathMapping.set(filepath, targetPath);
            await plugin.app.fileManager.processFrontMatter(
              targetMarkdownFile,
              (fm) => {
                const assetsRaw = (fm as Record<string, unknown>)
                  .importedAssets;
                const assets: Record<string, string> =
                  assetsRaw &&
                  typeof assetsRaw === "object" &&
                  !Array.isArray(assetsRaw)
                    ? (assetsRaw as Record<string, string>)
                    : {};
                assets[filehash] = targetPath;
                (fm as Record<string, unknown>).importedAssets = assets;
              },
              stat,
            );
            console.log(`Reusing existing file at path: ${targetPath}`);
            continue;
          }
          // Local file was modified since fileRef's last_modified; overwrite with DB version
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

      const options = { mtime: fileRef.last_modified, ctime: fileRef.created };
      // Save file to vault
      const existingFileForOverwrite =
        plugin.app.vault.getAbstractFileByPath(targetPath);
      if (
        existingFileForOverwrite &&
        existingFileForOverwrite instanceof TFile
      ) {
        await plugin.app.vault.modifyBinary(
          existingFileForOverwrite,
          fileContent,
          options,
        );
      } else {
        await plugin.app.vault.createBinary(targetPath, fileContent, options);
      }

      // Update frontmatter to track this mapping
      await plugin.app.fileManager.processFrontMatter(
        targetMarkdownFile,
        (fm) => {
          const assetsRaw = (fm as Record<string, unknown>).importedAssets;
          const assets: Record<string, string> =
            assetsRaw &&
            typeof assetsRaw === "object" &&
            !Array.isArray(assetsRaw)
              ? (assetsRaw as Record<string, string>)
              : {};
          assets[filehash] = targetPath;
          (fm as Record<string, unknown>).importedAssets = assets;
        },
        stat,
      );

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
): { frontmatter: ParsedFrontmatter; body: string } => {
  const { data, content: body } = matter(content);
  return {
    frontmatter: (data ?? {}) as ParsedFrontmatter,
    body: body ?? "",
  };
};

/**
 * Parse literal_content from a Concept schema into fields for DiscourseNode.
 * Handles both nested form { label, template, source_data: { format, color, tag } }
 * and flat form { id, name, color, format, tag }.
 */
const parseSchemaLiteralContent = (
  literalContent: unknown,
  fallbackName: string,
): Pick<
  DiscourseNode,
  "name" | "format" | "color" | "tag" | "template" | "keyImage"
> => {
  const obj =
    typeof literalContent === "string"
      ? (JSON.parse(literalContent) as Record<string, unknown>)
      : (literalContent as Record<string, unknown>) || {};
  const src = (obj.source_data as Record<string, unknown>) || obj;
  const name = (obj.name as string) || (obj.label as string) || fallbackName;
  const formatFromSchema =
    (src.format as string) || (obj.format as string) || "";
  const format =
    formatFromSchema || `${name.slice(0, 3).toUpperCase()} - {content}`;
  return {
    name,
    format,
    color: (src.color as string) || (obj.color as string) || undefined,
    tag: (src.tag as string) || (obj.tag as string) || undefined,
    template: (obj.template as string) || undefined,
    keyImage:
      (src.keyImage as boolean) ?? (obj.keyImage as boolean) ?? undefined,
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
  // Find the schema in the source space with this nodeTypeId (my_concepts applies RLS)
  const { data: schemaData } = await client
    .from("my_concepts")
    .select("name, literal_content")
    .eq("space_id", sourceSpaceId)
    .eq("is_schema", true)
    .eq("source_local_id", sourceNodeTypeId)
    .maybeSingle();

  if (!schemaData?.name) {
    return sourceNodeTypeId;
  }

  const schemaName = schemaData.name;

  // Prefer match by node type ID (imported type may already exist locally with same id)
  const matchById = plugin.settings.nodeTypes.find(
    (nt) => nt.id === sourceNodeTypeId,
  );
  if (matchById) {
    return matchById.id;
  }

  // Fall back to match by name
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
  plugin.settings.nodeTypes = [...plugin.settings.nodeTypes, newNodeType];
  await plugin.saveSettings();
  return newNodeType.id;
};

const processFileContent = async ({
  plugin,
  client,
  sourceSpaceId,
  sourceSpaceUri,
  rawContent,
  filePath,
  importedCreatedAt,
  importedModifiedAt,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  sourceSpaceId: number;
  sourceSpaceUri: string;
  rawContent: string;
  filePath: string;
  importedCreatedAt?: number;
  importedModifiedAt?: number;
}): Promise<{ file: TFile; error?: string }> => {
  // 1. Create or update the file with the fetched content first.
  // On create, set file metadata (ctime/mtime) to original vault dates via vault adapter.
  let file: TFile | null = plugin.app.vault.getFileByPath(filePath);
  const stat =
    importedCreatedAt !== undefined && importedModifiedAt !== undefined
      ? {
          ctime: importedCreatedAt,
          mtime: importedModifiedAt,
        }
      : undefined;
  if (!file) {
    file = await plugin.app.vault.create(filePath, rawContent, stat);
  } else {
    await plugin.app.vault.modify(file, rawContent, stat);
  }

  // 2. Parse frontmatter from rawContent (metadataCache is updated async and is
  //    often empty immediately after create/modify), then map nodeTypeId and update frontmatter.
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

  await plugin.app.fileManager.processFrontMatter(
    file,
    (fm) => {
      const record = fm as Record<string, unknown>;
      if (mappedNodeTypeId !== undefined) {
        record.nodeTypeId = mappedNodeTypeId;
      }
      record.importedFromSpaceUri = sourceSpaceUri;
    },
    stat,
  );

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

  const spaceUris = await getSpaceUris(client, [...nodesBySpace.keys()]);

  // Process each space
  for (const [spaceId, nodes] of nodesBySpace.entries()) {
    const spaceName = await getSpaceNameFromId(client, spaceId);
    const importFolderPath = `import/${sanitizeFileName(spaceName)}`;
    const assetsFolderPath = `${importFolderPath}/assets`;
    const spaceUri = spaceUris.get(spaceId);
    if (!spaceUri) {
      console.warn(`Missing URI for space ${spaceId}`);
      for (const _node of nodes) {
        failedCount++;
        processedCount++;
        onProgress?.(processedCount, totalNodes);
      }
      continue;
    }

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
        // Check if file already exists by nodeInstanceId + importedFromSpaceUri
        const existingFile = queryEngine.findExistingImportedFile(
          node.nodeInstanceId,
          spaceUri,
        );

        console.log("existingFile", existingFile);

        // Fetch the file name (direct variant) and content (full variant)
        const fileName = await fetchNodeContent({
          client,
          spaceId,
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

        const contentWithMeta = await fetchNodeContentWithMetadata({
          client,
          spaceId,
          nodeInstanceId: node.nodeInstanceId,
          variant: "full",
        });

        if (contentWithMeta === null) {
          console.warn(`No full variant found for node ${node.nodeInstanceId}`);
          failedCount++;
          processedCount++;
          onProgress?.(processedCount, totalNodes);
          continue;
        }

        const { content } = contentWithMeta;
        const createdAt = node.createdAt ?? contentWithMeta.createdAt;
        const modifiedAt = node.modifiedAt ?? contentWithMeta.modifiedAt;

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

        // Process the file content (maps nodeTypeId, handles frontmatter, stores import timestamps)
        // This updates existing file or creates new one
        const result = await processFileContent({
          plugin,
          client,
          sourceSpaceId: spaceId,
          sourceSpaceUri: spaceUri,
          rawContent: content,
          filePath: finalFilePath,
          importedCreatedAt: createdAt,
          importedModifiedAt: modifiedAt,
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
          spaceId,
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
  const supabaseClient = client || (await getLoggedInClient(plugin));
  if (!supabaseClient) {
    throw new Error("Cannot get Supabase client");
  }
  const cache = plugin.app.metadataCache.getFileCache(file);
  const frontmatter = cache?.frontmatter as Record<string, unknown> | undefined;
  if (!frontmatter?.importedFromSpaceUri || !frontmatter?.nodeInstanceId) {
    return {
      success: false,
      error: "Missing frontmatter: importedFromSpaceUri or nodeInstanceId",
    };
  }
  const { spaceName, spaceId } = await getSpaceNameIdFromUri(
    supabaseClient,
    frontmatter.importedFromSpaceUri as string,
  );
  if (spaceId === -1) {
    return { success: false, error: "Could not get the space Id" };
  }
  const result = await importSelectedNodes({
    plugin,
    selectedNodes: [
      {
        nodeInstanceId: frontmatter.nodeInstanceId as string,
        title: file.basename,
        spaceId,
        spaceName,
        groupId:
          (frontmatter.publishedToGroups as string[] | undefined)?.[0] ?? "",
        selected: false,
      },
    ],
  });
  return {
    success: result.success > 0,
    error: result.failed > 0 ? "Failed to refresh imported file" : undefined,
  };
};

/**
 * Refresh all imported files in the vault
 */
export const refreshAllImportedFiles = async (
  plugin: DiscourseGraphPlugin,
): Promise<{
  success: number;
  failed: number;
  errors: Array<{ file: string; error: string }>;
}> => {
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
    if (frontmatter?.importedFromSpaceUri && frontmatter?.nodeInstanceId) {
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
