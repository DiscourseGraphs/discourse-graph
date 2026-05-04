import { DataAdapter, Notice } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { ImportFolderMetadata } from "~/types";

const DG_METADATA_FILE = ".dg.metadata";
const IMPORT_ROOT = "import";

const sanitizeFileName = (fileName: string): string => {
  return fileName
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
};

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

export const resolveFolderForSpaceUri = async ({
  adapter,
  spaceUri,
  spaceName,
}: {
  adapter: DataAdapter;
  spaceUri: string;
  spaceName: string;
}): Promise<string> => {
  const spaceUriToFolder = await buildSpaceUriToFolderMap(adapter);

  // 1. Exact spaceUri match
  if (spaceUriToFolder.has(spaceUri)) {
    const folderPath = spaceUriToFolder.get(spaceUri)!;
    const existingMetadata = await readImportFolderMetadata(
      adapter,
      folderPath,
    );
    if (existingMetadata && existingMetadata.spaceName !== spaceName) {
      await writeImportFolderMetadata({
        adapter,
        folderPath,
        metadata: { ...existingMetadata, spaceName },
      });
    }
    return folderPath;
  }

  // 2. Fallback: scan for a folder whose basename matches the sanitized spaceName
  //    but has no metadata yet
  const { folders } = (await adapter.exists(IMPORT_ROOT))
    ? await adapter.list(IMPORT_ROOT)
    : { folders: [] };

  const sanitized = sanitizeFileName(spaceName);

  for (const folderPath of folders) {
    const basename = folderPath.split("/").pop();
    if (basename === sanitized) {
      const existingMetadata = await readImportFolderMetadata(
        adapter,
        folderPath,
      );
      if (!existingMetadata) {
        await writeImportFolderMetadata({
          adapter,
          folderPath,
          metadata: { spaceUri, spaceName },
        });
        return folderPath;
      }
    }
  }

  // 3. Create a new folder, handling name collisions
  const desiredPath = `${IMPORT_ROOT}/${sanitized}`;
  const desiredExists = await adapter.exists(desiredPath);

  let newPath: string;
  if (desiredExists) {
    // The existing folder has a different spaceUri (would have been returned above otherwise)
    newPath = `${IMPORT_ROOT}/${sanitized}-${generateShortId()}`;
  } else {
    newPath = desiredPath;
  }

  await adapter.mkdir(newPath);
  await writeImportFolderMetadata({
    adapter,
    folderPath: newPath,
    metadata: { spaceUri, spaceName },
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
    const sanitized = sanitizeFileName(name);
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
      const spaceUri = [...spaceUris][0];
      await writeImportFolderMetadata({
        adapter,
        folderPath,
        metadata: { spaceUri, spaceName: spaceNames[spaceUri] ?? basename },
      });
    }
  }
};
