import { DataAdapter, Notice } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { ImportFolderMetadata } from "~/types";

const DG_METADATA_FILE = ".dg.metadata";
const IMPORT_ROOT = "import";

const sanitizeImportFolderName = (fileName: string): string => {
  return fileName
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

const buildImportFolderBasename = (
  userName: string,
  spaceName: string,
): string => {
  return sanitizeImportFolderName(`${userName}-${spaceName}`);
};

const generateShortId = (): string => Math.random().toString(36).slice(2, 8);

const getImportFolderBasename = (folderPath: string): string =>
  folderPath.split("/").pop() ?? "";

const isImportFolderMetadata = (
  value: unknown,
): value is ImportFolderMetadata => {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.spaceUri === "string" && typeof v.spaceName === "string";
};

const parseImportFolderMetadataRaw = (
  raw: string,
): ImportFolderMetadata | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    try {
      // Tolerate trailing commas in case the file was hand-edited outside the plugin.
      parsed = JSON.parse(raw.replace(/,\s*([\]}])/g, "$1"));
    } catch {
      return null;
    }
  }

  return isImportFolderMetadata(parsed) ? parsed : null;
};

const readImportFolderMetadata = async (
  adapter: DataAdapter,
  folderPath: string,
): Promise<ImportFolderMetadata | null> => {
  const metadataPath = `${folderPath}/${DG_METADATA_FILE}`;
  try {
    const exists = await adapter.exists(metadataPath);
    if (!exists) return null;

    const raw = await adapter.read(metadataPath);
    return parseImportFolderMetadataRaw(raw);
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

  let keptFolderPath: string | null = null;

  for (const folderPath of folders) {
    const metadata = await readImportFolderMetadata(adapter, folderPath);
    if (metadata?.spaceUri !== spaceUri) continue;

    if (keptFolderPath === null) {
      keptFolderPath = folderPath;
      continue;
    }

    keptFolderPath = await resolveMetadataDuplicate({
      adapter,
      existingFolderPath: keptFolderPath,
      newFolderPath: folderPath,
    });
  }

  if (!keptFolderPath) return null;

  const metadata = await readImportFolderMetadata(adapter, keptFolderPath);
  if (!metadata) return null;

  return { folderPath: keptFolderPath, metadata };
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

export const resolveFolderForSpaceUri = async ({
  adapter,
  spaceUri,
  spaceName,
  ownerUserName,
}: {
  adapter: DataAdapter;
  spaceUri: string;
  spaceName: string;
  ownerUserName?: string;
}): Promise<string> => {
  const existingFolder = await findImportFolderBySpaceUri({
    adapter,
    spaceUri,
  });
  if (existingFolder) {
    if (existingFolder.metadata.spaceName !== spaceName) {
      await writeImportFolderMetadata({
        adapter,
        folderPath: existingFolder.folderPath,
        metadata: { ...existingFolder.metadata, spaceName },
      });
    }
    return existingFolder.folderPath;
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

    await writeImportFolderMetadata({
      adapter,
      folderPath,
      metadata: {
        spaceUri,
        spaceName,
        ...(ownerUserName ? { userName: ownerUserName } : {}),
      },
    });
    return folderPath;
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
      ...(ownerUserName ? { userName: ownerUserName } : {}),
    },
  });

  return newPath;
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
