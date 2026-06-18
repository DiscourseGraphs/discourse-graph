import { App, DataAdapter, Notice, TFolder } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { ImportFolderMetadata } from "~/types";
import {
  buildImportFolderBasename,
  sanitizeImportFolderName,
} from "./importFolderNaming";

const DG_METADATA_FILE = ".dg.metadata";
const IMPORT_ROOT = "import";

const generateShortId = (): string => Math.random().toString(36).slice(2, 8);

const getImportFolderBasename = (folderPath: string): string =>
  folderPath.split("/").pop() ?? "";

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

const findImportFolderBySpaceUri = async ({
  adapter,
  spaceUri,
}: {
  adapter: DataAdapter;
  spaceUri: string;
}): Promise<{ folderPath: string; metadata: ImportFolderMetadata } | null> => {
  const importExists = await adapter.exists(IMPORT_ROOT);
  if (!importExists) return null;

  const { folders } = await adapter.list(IMPORT_ROOT);

  for (const folderPath of folders) {
    const metadata = await readImportFolderMetadata(adapter, folderPath);
    if (metadata?.spaceUri === spaceUri) {
      return { folderPath, metadata };
    }
  }

  return null;
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

const renameImportFolder = async ({
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

const reconcileImportFolderForSpace = async ({
  app,
  adapter,
  folderPath,
  metadata,
  spaceUri,
  spaceName,
  ownerUserName,
  warnIfUserNameMissing = false,
}: {
  app: App;
  adapter: DataAdapter;
  folderPath: string;
  metadata: ImportFolderMetadata;
  spaceUri: string;
  spaceName: string;
  ownerUserName?: string;
  warnIfUserNameMissing?: boolean;
}): Promise<string> => {
  const userName = ownerUserName ?? metadata.userName;
  const updatedMetadata: ImportFolderMetadata = {
    ...metadata,
    spaceName,
    ...(userName ? { userName } : {}),
  };

  const writeIfChanged = async (): Promise<void> => {
    if (
      updatedMetadata.spaceName !== metadata.spaceName ||
      updatedMetadata.userName !== metadata.userName
    ) {
      await writeImportFolderMetadata({
        adapter,
        folderPath,
        metadata: updatedMetadata,
      });
    }
  };

  if (metadata.migrated) {
    await writeIfChanged();
    return folderPath;
  }

  if (!userName) {
    if (warnIfUserNameMissing) {
      console.warn(
        `Discourse Graphs: skipping import folder rename for "${folderPath}" — owner username unknown.`,
      );
    } else {
      await writeIfChanged();
    }
    return folderPath;
  }

  const targetBasename = buildImportFolderBasename(userName, spaceName);
  let finalPath = folderPath;

  if (getImportFolderBasename(folderPath) !== targetBasename) {
    finalPath = await resolveUniqueImportFolderPath({
      adapter,
      desiredBasename: targetBasename,
      spaceUri,
    });
    if (finalPath !== folderPath) {
      await renameImportFolder({
        app,
        adapter,
        oldPath: folderPath,
        newPath: finalPath,
      });
    }
  }

  await writeImportFolderMetadata({
    adapter,
    folderPath: finalPath,
    metadata: { ...updatedMetadata, userName, migrated: true },
  });

  return finalPath;
};

export const resolveFolderForSpaceUri = async ({
  adapter,
  app,
  spaceUri,
  spaceName,
  ownerUserName,
}: {
  adapter: DataAdapter;
  app: App;
  spaceUri: string;
  spaceName: string;
  ownerUserName?: string;
}): Promise<string> => {
  const existingFolder = await findImportFolderBySpaceUri({
    adapter,
    spaceUri,
  });
  if (existingFolder) {
    return reconcileImportFolderForSpace({
      app,
      adapter,
      folderPath: existingFolder.folderPath,
      metadata: existingFolder.metadata,
      spaceUri,
      spaceName,
      ownerUserName,
    });
  }

  const { folders } = (await adapter.exists(IMPORT_ROOT))
    ? await adapter.list(IMPORT_ROOT)
    : { folders: [] };

  const sanitizedSpaceName = sanitizeImportFolderName(spaceName);

  for (const folderPath of folders) {
    if (getImportFolderBasename(folderPath) !== sanitizedSpaceName) continue;

    const existingMetadata = await readImportFolderMetadata(
      adapter,
      folderPath,
    );
    if (existingMetadata) continue;

    const metadata: ImportFolderMetadata = {
      spaceUri,
      spaceName,
      ...(ownerUserName ? { userName: ownerUserName } : {}),
    };
    await writeImportFolderMetadata({ adapter, folderPath, metadata });
    return reconcileImportFolderForSpace({
      app,
      adapter,
      folderPath,
      metadata,
      spaceUri,
      spaceName,
      ownerUserName,
    });
  }

  const desiredBasename = ownerUserName
    ? buildImportFolderBasename(ownerUserName, spaceName)
    : sanitizedSpaceName;
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
    const authorId = plugin.app.metadataCache.getFileCache(file)?.frontmatter
      ?.authorId as number | undefined;
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
    if (!metadata || metadata.migrated) continue;

    const userName =
      metadata.userName ?? resolveUserNameFromFolder(plugin, folderPath);

    await reconcileImportFolderForSpace({
      app: plugin.app,
      adapter,
      folderPath,
      metadata,
      spaceUri: metadata.spaceUri,
      spaceName: metadata.spaceName,
      ownerUserName: userName,
      warnIfUserNameMissing: true,
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

    const basename = getImportFolderBasename(folderPath);
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
