/* eslint-disable @typescript-eslint/naming-convention */
import type { Json } from "@repo/database/dbTypes";
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
    filePath: string | undefined;
  }>
> => {
  if (groupIds.length === 0) {
    return [];
  }

  // Query my_contents (RLS applied); exclude current space. Get both variants so we can use
  // the latest last_modified per node and prefer "direct" for text (title).
  const { data, error } = await client
    .from("my_contents")
    .select(
      "source_local_id, space_id, text, created, last_modified, variant, metadata",
    )
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
    metadata: Json;
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
    filePath: string | undefined;
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
    const filePath: string | undefined =
      direct &&
      typeof direct.metadata === "object" &&
      typeof (direct.metadata as Record<string, any>).filePath === "string"
        ? (direct.metadata as Record<string, any>).filePath
        : undefined;
    nodes.push({
      source_local_id: latest.source_local_id!,
      space_id: latest.space_id!,
      text,
      createdAt,
      modifiedAt,
      filePath,
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
 * Fetches both direct (title) and full (body + dates) variants in one query.
 * Used by importSelectedNodes to avoid two round-trips to the content table.
 */
const fetchNodeContentForImport = async ({
  client,
  spaceId,
  nodeInstanceId,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  nodeInstanceId: string;
}): Promise<{
  fileName: string;
  content: string;
  createdAt: number;
  modifiedAt: number;
  filePath?: string;
} | null> => {
  const { data, error } = await client
    .from("my_contents")
    .select("text, created, last_modified, variant, metadata")
    .eq("source_local_id", nodeInstanceId)
    .eq("space_id", spaceId)
    .in("variant", ["direct", "full"]);

  if (error) {
    console.error("Error fetching node content for import:", error);
    return null;
  }

  const rows = (data ?? []) as Array<{
    text: string | null;
    created: string | null;
    last_modified: string | null;
    variant: string | null;
    metadata: Json;
  }>;
  const direct = rows.find((r) => r.variant === "direct");
  const full = rows.find((r) => r.variant === "full");

  if (
    !direct?.text ||
    !full?.text ||
    full.created == null ||
    full.last_modified == null
  ) {
    if (!direct?.text) {
      console.warn(`No direct variant found for node ${nodeInstanceId}`);
    }
    if (!full?.text) {
      console.warn(`No full variant found for node ${nodeInstanceId}`);
    }
    return null;
  }

  const filePath: string | undefined =
    typeof direct.metadata === "object" &&
    typeof (direct.metadata as Record<string, any>).filePath === "string"
      ? (direct.metadata as Record<string, any>).filePath
      : undefined;
  return {
    fileName: direct.text,
    content: full.text,
    createdAt: new Date(full.created).valueOf(),
    modifiedAt: new Date(full.last_modified).valueOf(),
    filePath,
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

/** Normalize path for lookup: strip leading "./", collapse slashes. Shared so pathMapping keys match link paths. */
const normalizePathForLookup = (p: string): string =>
  p.replace(/^\.\//, "").replace(/\/+/g, "/").trim();

const updateMarkdownAssetLinks = ({
  content,
  oldPathToNewPath,
  targetFile,
  app,
  originalNodePath,
}: {
  content: string;
  oldPathToNewPath: Map<string, string>;
  targetFile: TFile;
  app: App;
  originalNodePath?: string;
}): string => {
  if (oldPathToNewPath.size === 0) {
    return content;
  }

  // Create a set of all new paths for quick lookup (used by findImportedAssetFile)
  const newPaths = new Set(oldPathToNewPath.values());

  let updatedContent = content;

  const noteDir = targetFile.path.includes("/")
    ? targetFile.path.replace(/\/[^/]*$/, "")
    : "";

  /** Path of targetFile relative to the current note, for use in links. Obsidian resolves relative links from the note's directory. */
  const getRelativeLinkPath = (assetPath: string): string => {
    const noteParts = noteDir ? noteDir.split("/").filter(Boolean) : [];
    const targetParts = assetPath.split("/").filter(Boolean);
    let i = 0;
    while (
      i < noteParts.length &&
      i < targetParts.length &&
      noteParts[i] === targetParts[i]
    ) {
      i++;
    }
    const ups = noteParts.length - i;
    const down = targetParts.slice(i);
    const segments = [...Array(ups).fill(".."), ...down];
    return segments.join("/");
  };

  // Resolve a path with ".." and "." segments relative to a base directory (vault-relative).
  const resolvePathRelativeToBase = (
    baseDir: string,
    relativePath: string,
  ): string => {
    const baseParts = baseDir ? baseDir.split("/").filter(Boolean) : [];
    const pathParts = relativePath.replace(/\/+/g, "/").trim().split("/");
    const result = [...baseParts];
    for (const part of pathParts) {
      if (part === "..") {
        result.pop();
      } else if (part !== "." && part !== "") {
        result.push(part);
      }
    }
    return result.join("/");
  };

  // Canonical form for matching link paths to oldPath (vault-relative, no import prefix).
  const getLinkCanonicalForMatch = (linkPath: string): string => {
    const resolved = resolvePathRelativeToBase(noteDir, linkPath);
    if (resolved.startsWith("import/")) {
      const segments = resolved.split("/");
      return segments.length > 2 ? segments.slice(2).join("/") : resolved;
    }
    return resolved;
  };

  // Resolve link relative to the source note's directory (for "path from current file" when imported note is flattened).
  const getCanonicalFromOriginalNote = (
    linkPath: string,
  ): string | undefined => {
    if (!originalNodePath) return undefined;
    const originalNoteDir = originalNodePath.includes("/")
      ? originalNodePath.replace(/\/[^/]*$/, "")
      : "";
    return normalizePathForLookup(
      resolvePathRelativeToBase(originalNoteDir, linkPath),
    );
  };

  // Look up new path by link as written in content: use canonical form (resolve relative + strip import prefix).
  const getNewPathForLink = (linkPath: string): string | undefined => {
    const canonical = normalizePathForLookup(
      getLinkCanonicalForMatch(linkPath),
    );
    const byCanonical = oldPathToNewPath.get(canonical);
    if (byCanonical) return byCanonical;
    const byRaw = oldPathToNewPath.get(normalizePathForLookup(linkPath));
    if (byRaw) return byRaw;
    // "Path from current file" in source: link was relative to source note; pathMapping keys are source vault-relative.
    const fromOriginal = getCanonicalFromOriginalNote(linkPath);
    return fromOriginal ? oldPathToNewPath.get(fromOriginal) : undefined;
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
        const linkText = getRelativeLinkPath(importedAssetFile.path);
        if (alias) {
          return `[[${linkText}|${alias}]]`;
        }
        return `[[${linkText}]]`;
      }

      // Direct lookup from pathMapping (record built when we downloaded each asset)
      const newPath = getNewPathForLink(linkPath);
      if (newPath) {
        const newFile = app.metadataCache.getFirstLinkpathDest(
          newPath,
          targetFile.path,
        );
        if (newFile) {
          const linkText = getRelativeLinkPath(newFile.path);
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
        const linkText = getRelativeLinkPath(importedAssetFile.path);
        return `![${alt}](${linkText})`;
      }

      // Direct lookup from pathMapping (record built when we downloaded each asset)
      const newPath = getNewPathForLink(cleanPath);
      if (newPath) {
        const newFile = app.metadataCache.getFirstLinkpathDest(
          newPath,
          targetFile.path,
        );
        if (newFile) {
          const linkText = getRelativeLinkPath(newFile.path);
          return `![${alt}](${linkText})`;
        }
      }

      return match;
    },
  );

  return updatedContent;
};

/** Path of an asset relative to the note's directory (vault-relative). If asset is not under note dir, returns full path. */
const getAssetPathRelativeToNote = (
  assetFilePath: string,
  originalNodePath: string,
): string => {
  const noteDir = originalNodePath.includes("/")
    ? originalNodePath.replace(/\/[^/]*$/, "")
    : "";
  if (!noteDir || !assetFilePath.startsWith(`${noteDir}/`)) {
    return assetFilePath;
  }
  return assetFilePath.slice(noteDir.length + 1);
};

const importAssetsForNode = async ({
  plugin,
  client,
  spaceId,
  nodeInstanceId,
  spaceName,
  targetMarkdownFile,
  originalNodePath,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  spaceId: number;
  nodeInstanceId: string;
  spaceName: string;
  targetMarkdownFile: TFile;
  /** Source vault path of the note (e.g. from Content metadata filePath). Used to place assets under import/{space}/ relative to note. */
  originalNodePath?: string;
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

  const setPathMapping = (oldPath: string, newPath: string): void => {
    pathMapping.set(oldPath, newPath);
    pathMapping.set(normalizePathForLookup(oldPath), newPath);
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

  const importBasePath = `import/${sanitizeFileName(spaceName)}`;

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
          setPathMapping(filepath, existingFile.path);
          console.log(
            `Reusing existing asset: ${filehash} -> ${existingFile.path}`,
          );
          continue;
        }
        overwritePath = existingFile.path;
      }

      // Target path: import/{spaceName}/{path relative to note}. If sourceNotePath is set and asset
      // is under the note's directory, use that relative path so assets sit under import/{space}/.
      console.log("sourceNotePath", originalNodePath);
      console.log("filepath", filepath);
      const pathForImport =
        originalNodePath !== undefined
          ? getAssetPathRelativeToNote(filepath, originalNodePath)
          : filepath;
      console.log("pathForImport", pathForImport);
      const sanitizedAssetPath = pathForImport
        .split("/")
        .map(sanitizeFileName)
        .join("/");
      console.log("sanitizedAssetPath", sanitizedAssetPath);
      const targetPath =
        overwritePath ?? `${importBasePath}/${sanitizedAssetPath}`;

      // Ensure all parent folders exist before writing
      const pathParts = targetPath.split("/");
      for (let i = 1; i < pathParts.length - 1; i++) {
        const folderPath = pathParts.slice(0, i + 1).join("/");
        if (!(await plugin.app.vault.adapter.exists(folderPath))) {
          await plugin.app.vault.createFolder(folderPath);
        }
      }

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
            setPathMapping(filepath, targetPath);
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

      // Track path mapping (raw + normalized key so updateMarkdownAssetLinks can lookup by link text)
      setPathMapping(filepath, targetPath);
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
  originalFilePath,
  filePath,
  importedCreatedAt,
  importedModifiedAt,
}: {
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
  sourceSpaceId: number;
  sourceSpaceUri: string;
  rawContent: string;
  originalFilePath?: string;
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
      record.lastModified = importedModifiedAt;
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

    // Process each node in this space
    for (const node of nodes) {
      try {
        // Check if file already exists by nodeInstanceId + importedFromSpaceUri
        const existingFile = queryEngine.findExistingImportedFile(
          node.nodeInstanceId,
          spaceUri,
        );

        const nodeContent = await fetchNodeContentForImport({
          client,
          spaceId,
          nodeInstanceId: node.nodeInstanceId,
        });

        if (!nodeContent) {
          failedCount++;
          processedCount++;
          onProgress?.(processedCount, totalNodes);
          continue;
        }

        const {
          fileName,
          content,
          createdAt: contentCreatedAt,
          modifiedAt: contentModifiedAt,
          filePath,
        } = nodeContent;
        const createdAt = node.createdAt ?? contentCreatedAt;
        const modifiedAt = node.modifiedAt ?? contentModifiedAt;
        const originalNodePath: string | undefined = node.filePath;

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
          originalFilePath: filePath,
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

        // Import assets for this node (use originalNodePath so assets go under import/{space}/ relative to note)
        const assetImportResult = await importAssetsForNode({
          plugin,
          client,
          spaceId,
          nodeInstanceId: node.nodeInstanceId,
          spaceName,
          targetMarkdownFile: processedFile,
          originalNodePath,
        });

        // Update markdown content with new asset paths if assets were imported
        if (assetImportResult.pathMapping.size > 0) {
          const currentContent = await plugin.app.vault.read(processedFile);
          const updatedContent = updateMarkdownAssetLinks({
            content: currentContent,
            oldPathToNewPath: assetImportResult.pathMapping,
            targetFile: processedFile,
            app: plugin.app,
            originalNodePath,
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
  if (
    typeof frontmatter.importedFromSpaceUri !== "string" ||
    typeof frontmatter.nodeInstanceId !== "string"
  ) {
    return {
      success: false,
      error: "Non-string frontmatter: importedFromSpaceUri or nodeInstanceId",
    };
  }
  const { spaceName, spaceId } = await getSpaceNameIdFromUri(
    supabaseClient,
    frontmatter.importedFromSpaceUri,
  );
  if (spaceId === -1) {
    return { success: false, error: "Could not get the space Id" };
  }
  const metadataResp = await supabaseClient
    .from("Content")
    .select("metadata")
    .eq("space_id", spaceId)
    .eq("source_local_id", frontmatter.nodeInstanceId)
    .eq("variant", "direct")
    .maybeSingle();
  const metadata = metadataResp.data?.metadata;
  const filePath: string | undefined =
    typeof metadata === "object" &&
    typeof (metadata as Record<string, any>).filePath === "string"
      ? (metadata as Record<string, any>).filePath
      : undefined;
  const result = await importSelectedNodes({
    plugin,
    selectedNodes: [
      {
        nodeInstanceId: frontmatter.nodeInstanceId,
        title: file.basename,
        spaceId,
        spaceName,
        filePath,
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
