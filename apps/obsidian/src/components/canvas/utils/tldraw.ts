import {
  createTLStore,
  defaultBindingUtils,
  TldrawFile,
  TLStore,
  loadSnapshot,
  TLStoreSnapshot,
  SerializedSchema,
} from "tldraw";
import {
  FRONTMATTER_KEY,
  TLDATA_DELIMITER_END,
  TLDATA_DELIMITER_START,
  TLDRAW_VERSION,
  VIEW_TYPE_TLDRAW_DG_PREVIEW,
} from "~/constants";
import DiscourseGraphPlugin from "~/index";
import { checkAndCreateFolder, getNewUniqueFilepath } from "~/utils/file";
import { Notice } from "obsidian";
import { format } from "date-fns";
import { ObsidianTLAssetStore } from "~/components/canvas/stores/assetStore";
import {
  DiscourseNodeUtil,
  DiscourseNodeUtilOptions,
} from "~/components/canvas/shapes/DiscourseNodeShape";
import { DiscourseRelationUtil } from "~/components/canvas/shapes/DiscourseRelationShape";
import { DiscourseRelationBindingUtil } from "~/components/canvas/shapes/DiscourseRelationBinding";
import { discourseNodeMigrations } from "~/components/canvas/shapes/discourseNodeMigrations";
import { textLinkMigrations } from "~/components/canvas/shapes/textLinkMigrations";
import { baseShapeUtils } from "~/components/canvas/shapes/baseShapeUtils";
import { toSerializedStore } from "~/components/canvas/utils/canvasFileSync";

export type TldrawPluginMetaData = {
  "plugin-version": string;
  "tldraw-version": string;
  uuid: string;
};

export type TldrawRawData = {
  tldrawFileFormatVersion: number;
  // we follow the tldraw schema of tldraw-in-obsidian plugin
  schema: unknown;
  records: unknown;
};

export type TLData = {
  meta: TldrawPluginMetaData;
  raw: TldrawRawData;
};

const APP_MIGRATIONS = [discourseNodeMigrations, textLinkMigrations];

// A file with no stored schema predates our own sequences but not tldraw's, so
// drop only our sequence ids. Migrations missing from the loaded schema replay
// in full (they are retroactive), while built-ins stay at their current version
// instead of re-running against already-migrated records.
export const schemaBeforeAppMigrations = (store: TLStore): SerializedSchema => {
  const appSequenceIds = new Set(APP_MIGRATIONS.map((m) => m.sequenceId));
  const { sequences, ...rest } = store.schema.serialize();
  return {
    ...rest,
    sequences: Object.fromEntries(
      Object.entries(sequences).filter(([id]) => !appSequenceIds.has(id)),
    ),
  };
};

export const processInitialData = (
  data: TLData,
  assetStore: ObsidianTLAssetStore,
  ctx: DiscourseNodeUtilOptions,
): { meta: TldrawPluginMetaData; store: TLStore } => {
  const customShapeUtils = [
    ...baseShapeUtils,
    DiscourseNodeUtil.configure(ctx),
    DiscourseRelationUtil.configure(ctx),
  ];

  const recordsData = toSerializedStore(data.raw.records);

  // Create store first (this creates the schema with migrations)
  const store = createTLStore({
    shapeUtils: customShapeUtils,
    bindingUtils: [...defaultBindingUtils, DiscourseRelationBindingUtil],
    assets: assetStore,
    migrations: APP_MIGRATIONS,
  });

  if (recordsData) {
    // data.raw.schema is unknown: it comes from the legacy on-disk format.
    const oldSchema =
      (data.raw.schema as SerializedSchema | undefined) ??
      schemaBeforeAppMigrations(store);
    const snapshot: TLStoreSnapshot = {
      store: recordsData,
      schema: oldSchema,
    };

    loadSnapshot(store, snapshot, { forceOverwriteSessionState: true });
  }

  return {
    meta: data.meta,
    store,
  };
};

export const createRawTldrawFile = (store?: TLStore): TldrawFile => {
  store ??= createTLStore();
  return {
    tldrawFileFormatVersion: 1,
    schema: store.schema.serialize(),
    records: store.allRecords(),
  };
};

export const getTLMetaTemplate = (
  pluginVersion: string,
  uuid: string = window.crypto.randomUUID(),
): TldrawPluginMetaData => {
  return {
    uuid,
    "plugin-version": pluginVersion,
    "tldraw-version": TLDRAW_VERSION,
  };
};

export const getTLDataTemplate = ({
  pluginVersion,
  tldrawFile,
  uuid,
}: {
  pluginVersion: string;
  tldrawFile: TldrawFile;
  uuid: string;
}): TLData => {
  return {
    meta: getTLMetaTemplate(pluginVersion, uuid),
    raw: tldrawFile,
  };
};

export const frontmatterTemplate = (data: string, tags: string[] = []) => {
  let str = "---\n";
  str += `${data}\n`;
  if (tags.length) {
    str += `tags: [${tags.map((t) => JSON.stringify(t)).join(", ")}]\n`;
  }
  str += "---\n";
  return str;
};

export const codeBlockTemplate = (data: TLData) => {
  let str = "```json" + ` ${TLDATA_DELIMITER_START}`;
  str += "\n";
  str += `${JSON.stringify(data, null, "\t")}\n`;
  str += `${TLDATA_DELIMITER_END}\n`;
  str += "```";
  return str;
};

export const tlFileTemplate = (frontmatter: string, codeblock: string) => {
  return `${frontmatter}\n\n${codeblock}`;
};

export const createEmptyTldrawContent = (
  pluginVersion: string,
  tags: string[] = [],
): string => {
  const tldrawFile = createRawTldrawFile();
  const tlData = getTLDataTemplate({
    pluginVersion,
    tldrawFile,
    uuid: window.crypto.randomUUID(),
  });
  const frontmatter = frontmatterTemplate(`${FRONTMATTER_KEY}: true`, tags);
  const codeblock = codeBlockTemplate(tlData);
  return tlFileTemplate(frontmatter, codeblock);
};

export const createCanvas = async (plugin: DiscourseGraphPlugin) => {
  try {
    const filename = `Canvas-${format(new Date(), "yyyy-MM-dd-HHmm")}`;
    const folderpath = plugin.settings.canvasFolderPath;
    const attachmentsFolder = plugin.settings.canvasAttachmentsFolderPath;

    await checkAndCreateFolder(folderpath, plugin.app.vault);
    await checkAndCreateFolder(attachmentsFolder, plugin.app.vault);
    const fname = getNewUniqueFilepath({
      vault: plugin.app.vault,
      filename: filename + ".md",
      folderpath,
    });

    const content = createEmptyTldrawContent(plugin.manifest.version);
    const file = await plugin.app.vault.create(fname, content);
    const leaf = plugin.app.workspace.getLeaf(false);
    await leaf.openFile(file);
    await leaf.setViewState({
      type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
      state: { file: file.path },
    });

    return file;
  } catch (e) {
    new Notice(e instanceof Error ? e.message : "Failed to create canvas file");
    console.error(e);
  }
};

/**
 * Get the updated markdown content with the new TLData
 * @param currentContent - The current markdown content
 * @param stringifiedData - The new TLData stringified
 * @returns The updated markdown content
 */
export const getUpdatedMdContent = (
  currentContent: string,
  stringifiedData: string,
) => {
  const regex = new RegExp(
    `${TLDATA_DELIMITER_START}([\\s\\S]*?)${TLDATA_DELIMITER_END}`,
  );
  return currentContent.replace(
    regex,
    `${TLDATA_DELIMITER_START}\n${stringifiedData}\n${TLDATA_DELIMITER_END}`,
  );
};
