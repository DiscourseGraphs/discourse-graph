import { App, DataAdapter, Notice, TFolder } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { ImportFolderMetadata } from "~/types";
import {
  buildImportFolderBasename,
  isCustomFolderBasename,
  isExpectedMigratedBasename,
  isLegacyFolderBasename,
  sanitizeImportFolderName,
  shouldAutoRenameFolder,
} from "./importFolderNaming";

export {
  buildImportFolderBasename,
  isCustomFolderBasename,
  isExpectedMigratedBasename,
  isLegacyFolderBasename,
  sanitizeImportFolderName,
  shouldAutoRenameFolder,
} from "./importFolderNaming";

const DG_METADATA_FILE = ".dg.metadata";
const IMPORT_ROOT = "import";

const generateShortId = (): string => Math.random().toString(36).slice(2, 8);

const readImportFolderMetadata = async (
  adapter: DataAdapter,
  folderPath: string,
): Promise<ImportFolderMetadata | null> => {
  const metadataPath = `${folderPath}/${DG_METADATA_FILE}`;
  try {
    const exists = await adapter.exists(metadataPath);
    if (!exists) return null;

    const raw = await adapter.read(metadataPath);
    const parsed: unknown = JSON.parse(raw);

    if (
      parsed !== null &&
      typeof parsed === "object" &&
      "spaceUri" in parsed &&
      typeof (parsed as Record<string, unknown>).spaceUri === "string"
    ) {
      return parsed as ImportFolderMetadata;
    }

    return null;
  } catch {
    return null;
  }
};

const writeImportFolderMetadata = async ({
  adapter,
  folderPath,
  metadata,
}: {
  adapter: DataAdapter;
  folderPath: string;
  metadata: ImportFolderMetadata;
}): Promise<void> => {
  const metadataPath = `${folderPath}/${DG_METADATA_FILE}`;
  await adapter.write(metadataPath, JSON.stringify(metadata, null, 2));
};

const resolveMetadataDuplicate = async ({
  adapter,
  existingFolderPath,
  newFolderPath,
}: {
  adapter: DataAdapter;
  existingFolderPath: string;
  newFolderPath: string;
}): Promise<string> => {
  const existingMetadataPath = `${existingFolderPath}/${DG_METADATA_FILE}`;
  const newMetadataPath = `${newFolderPath}/${DG_METADATA_FILE}`;

  const existingStat = await adapter.stat(existingMetadataPath);
  const newStat = await adapter.stat(newMetadataPath);

  const newIsNewer =
    existingStat && newStat && existingStat.mtime < newStat.mtime;
  if (newIsNewer) {
    await adapter.remove(existingMetadataPath);
    return newFolderPath;
  }

  await adapter.remove(newMetadataPath);
  return existingFolderPath;
};

const buildSpaceUriToFolderMap = async (
  adapter: DataAdapter,
): Promise<Map<string, string>> => {
  const map = new Map<string, string>();

  const importExists = await adapter.exists(IMPORT_ROOT);
  if (!importExists) return map;

  const { folders } = await adapter.list(IMPORT_ROOT);

  for (const folderPath of folders) {
    const metadata = await readImportFolderMetadata(adapter, folderPath);
    if (!metadata) continue;

    if (map.has(metadata.spaceUri)) {
      const existingPath = map.get(metadata.spaceUri)!;
      const keptPath = await resolveMetadataDuplicate({
        adapter,
        existingFolderPath: existingPath,
        newFolderPath: folderPath,
      });
      map.set(metadata.spaceUri, keptPath);
    } else {
      map.set(metadata.spaceUri, folderPath);
    }
  }

  return map;
};

const resolveUniqueImportFolderPath = async ({
  adapter,
  desiredBasename,
  spaceUri,
}: {
  adapter: DataAdapter;
  desiredBasename: string;
  spaceUri: string;
}): Promise<string> => {
  let basename = desiredBasename;
  let path = `${IMPORT_ROOT}/${basename}`;

  while (await adapter.exists(path)) {
    const existingMetadata = await readImportFolderMetadata(adapter, path);
    if (existingMetadata?.spaceUri === spaceUri) {
      return path;
    }
    basename = `${desiredBasename}-${generateShortId()}`;
    path = `${IMPORT_ROOT}/${basename}`;
  }

  return path;
};

export const renameImportFolder = async ({
  app,
  adapter,
  oldPath,
  newPath,
}: {
  app: App;
  adapter: DataAdapter;
  oldPath: string;
  newPath: string;
}): Promise<void> => {
  if (oldPath === newPath) return;

  const folder = app.vault.getAbstractFileByPath(oldPath);
  if (folder instanceof TFolder) {
    await app.fileManager.renameFile(folder, newPath);
    return;
  }

  await adapter.rename(oldPath, newPath);
};

const maybeRenameImportFolder = async ({
  app,
  adapter,
  folderPath,
  metadata,
  spaceUri,
  spaceName,
  ownerUserName,
}: {
  app?: App;
  adapter: DataAdapter;
  folderPath: string;
  metadata: ImportFolderMetadata;
  spaceUri: string;
  spaceName: string;
  ownerUserName?: string;
}): Promise<string> => {
  const basename = folderPath.split("/").pop() ?? "";
  const userName = ownerUserName ?? metadata.userName;
  const updatedMetadata: ImportFolderMetadata = {
    ...metadata,
    spaceName,
    ...(userName ? { userName } : {}),
  };

  if (metadata.migrated) {
    if (updatedMetadata.spaceName !== metadata.spaceName) {
      await writeImportFolderMetadata({
        adapter,
        folderPath,
        metadata: updatedMetadata,
      });
    }
    return folderPath;
  }

  if (userName && isExpectedMigratedBasename(basename, userName, spaceName)) {
    await writeImportFolderMetadata({
      adapter,
      folderPath,
      metadata: { ...updatedMetadata, migrated: true },
    });
    return folderPath;
  }

  if (isCustomFolderBasename({ basename, spaceName, userName })) {
    await writeImportFolderMetadata({
      adapter,
      folderPath,
      metadata: { ...updatedMetadata, migrated: true },
    });
    return folderPath;
  }

  if (!shouldAutoRenameFolder({ metadata, basename, spaceName, userName })) {
    if (updatedMetadata.spaceName !== metadata.spaceName) {
      await writeImportFolderMetadata({
        adapter,
        folderPath,
        metadata: updatedMetadata,
      });
    }
    return folderPath;
  }

  const newBasename = buildImportFolderBasename(userName!, spaceName);
  const newPath = await resolveUniqueImportFolderPath({
    adapter,
    desiredBasename: newBasename,
    spaceUri,
  });

  if (newPath !== folderPath) {
    if (app) {
      await renameImportFolder({ app, adapter, oldPath: folderPath, newPath });
    } else {
      await adapter.rename(folderPath, newPath);
    }
  }

  await writeImportFolderMetadata({
    adapter,
    folderPath: newPath,
    metadata: { ...updatedMetadata, userName: userName!, migrated: true },
  });

  return newPath;
};

export const resolveFolderForSpaceUri = async ({
  adapter,
  app,
  spaceUri,
  spaceName,
  ownerUserName,
}: {
  adapter: DataAdapter;
  app?: App;
  spaceUri: string;
  spaceName: string;
  ownerUserName?: string;
}): Promise<string> => {
  const spaceUriToFolder = await buildSpaceUriToFolderMap(adapter);

  // 1. Exact spaceUri match
  if (spaceUriToFolder.has(spaceUri)) {
    const folderPath = spaceUriToFolder.get(spaceUri)!;
    const existingMetadata = await readImportFolderMetadata(
      adapter,
      folderPath,
    );
    if (existingMetadata) {
      return maybeRenameImportFolder({
        app,
        adapter,
        folderPath,
        metadata: existingMetadata,
        spaceUri,
        spaceName,
        ownerUserName,
      });
    }
    return folderPath;
  }

  // 2. Fallback: scan for a folder whose basename matches the sanitized spaceName
  //    but has no metadata yet
  const { folders } = (await adapter.exists(IMPORT_ROOT))
    ? await adapter.list(IMPORT_ROOT)
    : { folders: [] };

  const sanitized = sanitizeImportFolderName(spaceName);

  for (const folderPath of folders) {
    const basename = folderPath.split("/").pop();
    if (basename === sanitized) {
      const existingMetadata = await readImportFolderMetadata(
        adapter,
        folderPath,
      );
      if (!existingMetadata) {
        const metadata: ImportFolderMetadata = {
          spaceUri,
          spaceName,
          ...(ownerUserName ? { userName: ownerUserName } : {}),
        };
        await writeImportFolderMetadata({
          adapter,
          folderPath,
          metadata,
        });
        return maybeRenameImportFolder({
          app,
          adapter,
          folderPath,
          metadata,
          spaceUri,
          spaceName,
          ownerUserName,
        });
      }
    }
  }

  // 3. Create a new folder, handling name collisions
  const desiredBasename = ownerUserName
    ? buildImportFolderBasename(ownerUserName, spaceName)
    : sanitized;
  const newPath = await resolveUniqueImportFolderPath({
    adapter,
    desiredBasename,
    spaceUri,
  });

  await adapter.mkdir(newPath);
  await writeImportFolderMetadata({
    adapter,
    folderPath: newPath,
    metadata: {
      spaceUri,
      spaceName,
      ...(ownerUserName ? { userName: ownerUserName, migrated: true } : {}),
    },
  });

  return newPath;
};

const resolveUserNameFromFolder = (
  plugin: DiscourseGraphPlugin,
  folderPath: string,
): string | undefined => {
  const userNames = plugin.settings.userNames ?? {};
  const files = plugin.app.vault
    .getMarkdownFiles()
    .filter((file) => file.path.startsWith(`${folderPath}/`));

  for (const file of files) {
    const authorId =
      plugin.app.metadataCache.getFileCache(file)?.frontmatter?.authorId;
    if (typeof authorId === "number" && userNames[authorId]) {
      return userNames[authorId];
    }
  }

  return undefined;
};

export const migrateImportFolderNames = async (
  plugin: DiscourseGraphPlugin,
): Promise<void> => {
  const adapter = plugin.app.vault.adapter;

  const importExists = await adapter.exists(IMPORT_ROOT);
  if (!importExists) return;

  const { folders } = await adapter.list(IMPORT_ROOT);

  for (const folderPath of folders) {
    const metadata = await readImportFolderMetadata(adapter, folderPath);
    if (!metadata) continue;

    const basename = folderPath.split("/").pop() ?? "";
    const userName =
      metadata.userName ?? resolveUserNameFromFolder(plugin, folderPath);

    if (metadata.migrated) continue;

    if (
      isCustomFolderBasename({
        basename,
        spaceName: metadata.spaceName,
        userName,
      })
    ) {
      await writeImportFolderMetadata({
        adapter,
        folderPath,
        metadata: { ...metadata, migrated: true },
      });
      continue;
    }

    if (
      !shouldAutoRenameFolder({
        metadata,
        basename,
        spaceName: metadata.spaceName,
        userName,
      })
    ) {
      if (!userName) {
        console.warn(
          `Discourse Graphs: skipping import folder rename for "${folderPath}" — owner username unknown.`,
        );
      }
      continue;
    }

    const newBasename = buildImportFolderBasename(
      userName!,
      metadata.spaceName,
    );
    const newPath = await resolveUniqueImportFolderPath({
      adapter,
      desiredBasename: newBasename,
      spaceUri: metadata.spaceUri,
    });

    if (newPath !== folderPath) {
      await renameImportFolder({
        app: plugin.app,
        adapter,
        oldPath: folderPath,
        newPath,
      });
    }

    await writeImportFolderMetadata({
      adapter,
      folderPath: newPath,
      metadata: {
        ...metadata,
        userName: userName!,
        migrated: true,
      },
    });
  }
};

export const migrateImportFolderMetadata = async (
  plugin: DiscourseGraphPlugin,
): Promise<void> => {
  const adapter = plugin.app.vault.adapter;

  const importExists = await adapter.exists(IMPORT_ROOT);
  if (!importExists) return;

  const { folders } = await adapter.list(IMPORT_ROOT);

  // Invert spaceNames: Record<spaceUri, spaceName> → Map<sanitizedName, Set<spaceUri>>
  // Using a Set per name to detect collisions — two different spaceUris can share
  // the same sanitized folder name, making the mapping ambiguous.
  const spaceNames = plugin.settings.spaceNames ?? {};
  const nameToSpaceUris = new Map<string, Set<string>>();
  for (const [spaceUri, name] of Object.entries(spaceNames)) {
    const sanitized = sanitizeImportFolderName(name);
    const existing = nameToSpaceUris.get(sanitized);
    if (existing) {
      existing.add(spaceUri);
      new Notice(
        `Discourse Graphs: ambiguous import folder name "${sanitized}" maps to multiple spaces — skipping migration for this folder.`,
      );
    } else {
      nameToSpaceUris.set(sanitized, new Set([spaceUri]));
    }
  }

  for (const folderPath of folders) {
    const metadataPath = `${folderPath}/${DG_METADATA_FILE}`;
    const metadataExists = await adapter.exists(metadataPath);
    if (metadataExists) continue;

    const basename = folderPath.split("/").pop() ?? "";
    const spaceUris = nameToSpaceUris.get(basename);

    if (spaceUris?.size === 1) {
      const spaceUri = [...spaceUris][0]!;
      await writeImportFolderMetadata({
        adapter,
        folderPath,
        metadata: { spaceUri, spaceName: spaceNames[spaceUri] ?? basename },
      });
    }
  }
};
