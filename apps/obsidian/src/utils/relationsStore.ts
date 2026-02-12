import { normalizePath, TFile } from "obsidian";
import { uuidv7 } from "uuidv7";
import type DiscourseGraphPlugin from "~/index";
import { ensureNodeInstanceId } from "~/utils/nodeInstanceId";
import { checkAndCreateFolder } from "~/utils/file";
import { getVaultId } from "./supabaseContext";

const RELATIONS_FILE_NAME = "relations.json";
const RELATIONS_FILE_VERSION = 1;

/** Vault-relative path for relations.json, under the same folder as nodes (nodesFolderPath). */
export const getRelationsFilePath = (plugin: DiscourseGraphPlugin): string => {
  const folderPath = plugin.settings.nodesFolderPath.trim();
  return folderPath
    ? normalizePath(`${folderPath}/${RELATIONS_FILE_NAME}`)
    : normalizePath(RELATIONS_FILE_NAME);
};

export type RelationInstance = {
  id: string;
  type: string;
  source: string;
  destination: string;
  created: number;
  author: string;
  lastModified?: number;
  importedFromSpaceId?: number;
  publishedToGroupId?: string[];
};

export type RelationsFile = {
  version: number;
  lastModified: number;
  relations: Record<string, RelationInstance>;
};

const defaultRelationsFile = (): RelationsFile => ({
  version: RELATIONS_FILE_VERSION,
  lastModified: 0,
  relations: {},
});

export const loadRelations = async (
  plugin: DiscourseGraphPlugin,
): Promise<RelationsFile> => {
  const path = getRelationsFilePath(plugin);
  const file = plugin.app.vault.getAbstractFileByPath(path);
  if (!file || !(file instanceof TFile)) {
    return defaultRelationsFile();
  }
  try {
    const content = await plugin.app.vault.read(file);
    const data = JSON.parse(content) as RelationsFile;
    if (
      typeof data.version !== "number" ||
      typeof data.lastModified !== "number" ||
      typeof data.relations !== "object" ||
      data.relations === null
    ) {
      return defaultRelationsFile();
    }
    return {
      version: data.version,
      lastModified: data.lastModified,
      relations: data.relations ?? {},
    };
  } catch {
    return defaultRelationsFile();
  }
};

export const saveRelations = async (
  plugin: DiscourseGraphPlugin,
  data: RelationsFile,
): Promise<void> => {
  const folderPath = plugin.settings.nodesFolderPath.trim();
  if (folderPath) {
    await checkAndCreateFolder(folderPath, plugin.app.vault);
  }
  const path = getRelationsFilePath(plugin);
  const toWrite: RelationsFile = {
    ...data,
    lastModified: Date.now(),
  };
  const content = JSON.stringify(toWrite, null, 2);
  const file = plugin.app.vault.getAbstractFileByPath(path);
  if (file instanceof TFile) {
    await plugin.app.vault.modify(file, content);
  } else {
    await plugin.app.vault.create(path, content);
  }
};

export type AddRelationParams = {
  type: string;
  source: string;
  destination: string;
  author?: string;
  importedFromSpaceId?: number;
  publishedToGroupId?: string[];
};

/**
 * Adds a relation without checking for an existing one between the same nodes/type.
 * Prefer addRelation() unless you intentionally need to skip the existence check (e.g. migration, sync).
 */
export const addRelationNoCheck = async (
  plugin: DiscourseGraphPlugin,
  params: AddRelationParams,
): Promise<string> => {
  const now = Date.now();
  const id = uuidv7();
  const author =
    params.author ?? plugin.settings.accountLocalId ?? getVaultId(plugin.app);
  const instance: RelationInstance = {
    id,
    type: params.type,
    source: params.source,
    destination: params.destination,
    created: now,
    author,
    importedFromSpaceId: params.importedFromSpaceId,
    publishedToGroupId: params.publishedToGroupId,
  };
  const data = await loadRelations(plugin);
  data.relations[id] = instance;
  await saveRelations(plugin, data);
  return id;
};

export type AddRelationResult = { id: string; alreadyExisted: boolean };

/**
 * Checks for an existing relation (same type, same two nodes in either direction), then adds if none.
 * Returns the relation id and whether it already existed.
 */
export const addRelation = async (
  plugin: DiscourseGraphPlugin,
  params: AddRelationParams,
): Promise<AddRelationResult> => {
  const existingId = await relationExistsBetweenNodes({
    plugin,
    sourceNodeInstanceId: params.source,
    destNodeInstanceId: params.destination,
    relationTypeId: params.type,
  });
  if (existingId) {
    return { id: existingId, alreadyExisted: true };
  }
  const id = await addRelationNoCheck(plugin, params);
  return { id, alreadyExisted: false };
};

export const removeRelationById = async (
  plugin: DiscourseGraphPlugin,
  relationInstanceId: string,
): Promise<boolean> => {
  const data = await loadRelations(plugin);
  if (!(relationInstanceId in data.relations)) {
    return false;
  }
  delete data.relations[relationInstanceId];
  await saveRelations(plugin, data);
  return true;
}

export const getRelationsForNodeInstanceId = async (
  plugin: DiscourseGraphPlugin,
  nodeInstanceId: string,
  data?: RelationsFile,
): Promise<RelationInstance[]> => {
  const relationsFile = data ?? (await loadRelations(plugin));
  const relations = relationsFile.relations ?? Object.create(null);
  return Object.values(relations).filter(
    (r) => r.source === nodeInstanceId || r.destination === nodeInstanceId,
  );
}

const DEFAULT_CACHE_WAIT_MS = 500;
const CACHE_POLL_INTERVAL_MS = 30;

/**
 * Waits for the metadata cache to contain frontmatter with nodeTypeId for the file
 * (e.g. after a file was just created). Polls at a short interval up to a timeout.
 */
const waitForDiscourseFrontmatter = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
  timeoutMs = DEFAULT_CACHE_WAIT_MS,
): Promise<Record<string, unknown> | null> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const fm = cache?.frontmatter;
    if (fm?.nodeTypeId) return fm as Record<string, unknown>;
    await new Promise((r) => setTimeout(r, CACHE_POLL_INTERVAL_MS));
  }
  return null;
};

export const getNodeInstanceIdForFile = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): Promise<string | null> => {
  let frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter as
    | Record<string, unknown>
    | undefined;

  if (!frontmatter?.nodeTypeId) {
    frontmatter =
      (await waitForDiscourseFrontmatter(plugin, file)) ?? undefined;
  }

  if (!frontmatter?.nodeTypeId) {
    return null;
  }
  return await ensureNodeInstanceId(plugin, file, frontmatter);
}

/**
 * Returns the node type id from a file's frontmatter (nodeTypeId).
 * Waits for metadata cache if not yet available (e.g. after file creation).
 */
export const getNodeTypeIdForFile = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
): Promise<string | null> => {
  let frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter as
    | Record<string, unknown>
    | undefined;

  if (!frontmatter?.nodeTypeId) {
    frontmatter =
      (await waitForDiscourseFrontmatter(plugin, file)) ?? undefined;
  }

  const nodeTypeId = frontmatter?.nodeTypeId;
  return typeof nodeTypeId === "string" ? nodeTypeId : null;
};

export const getFileForNodeInstanceId = async (
  plugin: DiscourseGraphPlugin,
  nodeInstanceId: string,
): Promise<TFile | null> => {
  const files = plugin.app.vault.getMarkdownFiles();
  for (const file of files) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const id = (cache?.frontmatter as Record<string, unknown> | undefined)
      ?.nodeInstanceId as string | undefined;
    if (id === nodeInstanceId) {
      return file;
    }
  }
  return null;
}

/**
 * Find a relation instance by source, destination, and type. Returns the first match.
 */
export const findRelationBySourceDestinationType = (
  data: RelationsFile,
  source: string,
  destination: string,
  type: string,
): RelationInstance | undefined => {
  return Object.values(data.relations).find(
    (r) =>
      r.source === source && r.destination === destination && r.type === type,
  );
};

/**
 * Returns true if a relation with the given type already exists between the two nodes
 * in either direction (source→dest or dest→source).
 */
export const relationExistsBetweenNodes = async ({
  plugin,
  sourceNodeInstanceId,
  destNodeInstanceId,
  relationTypeId,
}: {
  plugin: DiscourseGraphPlugin;
  sourceNodeInstanceId: string;
  destNodeInstanceId: string;
  relationTypeId: string;
}): Promise<string | null> => {
  const data = await loadRelations(plugin);
  const forward = findRelationBySourceDestinationType(
    data,
    sourceNodeInstanceId,
    destNodeInstanceId,
    relationTypeId,
  );
  if (forward) return forward.id;
  const reverse = findRelationBySourceDestinationType(
    data,
    destNodeInstanceId,
    sourceNodeInstanceId,
    relationTypeId,
  );
  return reverse ? reverse.id : null;
};

/**
 * Remove relation(s) matching source, destination, and type. Returns how many were removed.
 */
export const removeRelationBySourceDestinationType = async (
  plugin: DiscourseGraphPlugin,
  source: string,
  destination: string,
  type: string,
): Promise<number> => {
  const data = await loadRelations(plugin);
  let removed = 0;
  for (const [id, r] of Object.entries(data.relations)) {
    if (r.source === source && r.destination === destination && r.type === type) {
      delete data.relations[id];
      removed++;
    }
  }
  if (removed > 0) {
    await saveRelations(plugin, data);
  }
  return removed;
}

/**
 * Returns true if the frontmatter link (e.g. "[[path]]" or "[[path.md]]") resolves to the same file as targetFile.
 * Handles .md extension and other linktext variants that Obsidian treats as the same file.
 */
const frontmatterLinkPointsToFile = (
  plugin: DiscourseGraphPlugin,
  linkStr: string,
  sourceFilePath: string,
  targetFile: TFile,
): boolean => {
  const match = String(linkStr).trim().match(/\[\[(.*?)\]\]/);
  const linkpath = match?.[1]?.trim();
  if (!linkpath) return false;
  const resolved = plugin.app.metadataCache.getFirstLinkpathDest(
    linkpath,
    sourceFilePath,
  );
  return resolved?.path === targetFile.path;
};

/**
 * Migrates relation links from frontmatter (bi-directional links under relationType.id)
 * into relations.json. Idempotent: only adds relations that don't already exist.
 * After migrating each relation, removes the corresponding link from both files' frontmatter.
 */
const removeRelationLinkFromFrontmatter = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
  targetFile: TFile,
  relationTypeId: string,
): Promise<void> => {
  const removeFromFile = async (
    f: TFile,
    targetToRemove: TFile,
  ): Promise<void> => {
    await plugin.app.fileManager.processFrontMatter(f, (fm) => {
      const raw = fm[relationTypeId] as unknown;
      if (!raw) return;
      const links = Array.isArray(raw) ? (raw as string[]) : [raw as string];
      const filtered = links.filter(
        (link) =>
          !frontmatterLinkPointsToFile(plugin, link, f.path, targetToRemove),
      );
      if (filtered.length === 0) {
        delete fm[relationTypeId];
      } else {
        fm[relationTypeId] = filtered.length === 1 ? filtered[0] : filtered;
      }
    });
  };

  await removeFromFile(file, targetFile);
  await removeFromFile(targetFile, file);
};

export const migrateFrontmatterRelationsToRelationsJson = async (
  plugin: DiscourseGraphPlugin,
): Promise<void> => {
  const data = await loadRelations(plugin);
  const markdownFiles = plugin.app.vault.getMarkdownFiles();
  let added = 0;
  const pendingCleanups: Array<{
    file: TFile;
    targetFile: TFile;
    relationTypeId: string;
  }> = [];

  for (const file of markdownFiles) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter?.nodeTypeId) continue;

    const sourceNodeInstanceId = await ensureNodeInstanceId(
      plugin,
      file,
      frontmatter as Record<string, unknown>,
    );

    for (const relationType of plugin.settings.relationTypes) {
      const raw = frontmatter[relationType.id] as unknown;
      if (!raw) continue;

      const links = Array.isArray(raw) ? raw : [raw];
      for (const link of links) {
        const match = String(link).match(/\[\[(.*?)\]\]/);
        if (!match) continue;
        const linkedPath = match[1] ?? "";
        const targetFile = plugin.app.metadataCache.getFirstLinkpathDest(
          linkedPath,
          file.path,
        );
        if (!targetFile) continue;

        const targetCache = plugin.app.metadataCache.getFileCache(targetFile);
        const targetFrontmatter = targetCache?.frontmatter;
        if (!targetFrontmatter?.nodeTypeId) continue;

        const destNodeInstanceId = await ensureNodeInstanceId(
          plugin,
          targetFile,
          targetFrontmatter as Record<string, unknown>,
        );

        const alreadyExists = findRelationBySourceDestinationType(
          data,
          sourceNodeInstanceId,
          destNodeInstanceId,
          relationType.id,
        );
        if (alreadyExists) continue;

        const reverseExists = findRelationBySourceDestinationType(
          data,
          destNodeInstanceId,
          sourceNodeInstanceId,
          relationType.id,
        );
        if (reverseExists) continue;

        const id = uuidv7();
        const now = Date.now();
        const author = plugin.settings.accountLocalId ?? getVaultId(plugin.app);
        data.relations[id] = {
          id,
          type: relationType.id,
          source: sourceNodeInstanceId,
          destination: destNodeInstanceId,
          created: now,
          author,
        };
        added++;
        pendingCleanups.push({
          file,
          targetFile,
          relationTypeId: relationType.id,
        });
      }
    }
  }

  if (added > 0) {
    data.lastModified = Date.now();
    await saveRelations(plugin, data);
    for (const { file, targetFile, relationTypeId } of pendingCleanups) {
      await removeRelationLinkFromFrontmatter(
        plugin,
        file,
        targetFile,
        relationTypeId,
      );
    }
  }
}
