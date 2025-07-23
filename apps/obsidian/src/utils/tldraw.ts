import { createTLStore, TldrawFile, TLStore } from "tldraw";
import {
  FRONTMATTER_KEY,
  TLDATA_DELIMITER_END,
  TLDATA_DELIMITER_START,
  TLDRAW_VERSION,
} from "../constants";
import DiscourseGraphPlugin from "~/index";
import { checkAndCreateFolder, getNewUniqueFilepath } from "./file";
import { Notice } from "obsidian";
import { format } from "date-fns";

export type TldrawPluginMetaData = {
  "plugin-version": string;
  "tldraw-version": string;
  uuid: string;
};

export type TLData = {
  meta: TldrawPluginMetaData;
  raw: {
    tldrawFileFormatVersion: number;
    schema: any;
    records: any;
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
    str += `tags:\n[${tags.join(", ")}]\n`;
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
    // TODO: For now we'll create files in this default location, later we can add settings for this
    const folderpath = "tldraw-dg";

    await checkAndCreateFolder(folderpath, plugin.app.vault);
    const fname = getNewUniqueFilepath({
      vault: plugin.app.vault,
      filename: filename + ".md",
      folderpath,
    });

    const content = createEmptyTldrawContent(plugin.manifest.version);
    const file = await plugin.app.vault.create(fname, content);
    const leaf = plugin.app.workspace.getLeaf(false);
    await leaf.openFile(file);

    return file;
  } catch (e) {
    new Notice(e instanceof Error ? e.message : "Failed to create canvas file");
    console.error(e);
  }
};

export const replaceBetweenKeywords = (
  input: string,
  keyword1: string,
  keyword2: string,
  replacement: string,
) => {
  const regex = new RegExp(`${keyword1}[\\s\\S]*?${keyword2}`, "g");
  return input.replace(regex, `${keyword1}\n${replacement}\n${keyword2}`);
};

export const getUpdatedFileData = (
  plugin: DiscourseGraphPlugin,
  store: TLStore,
): TLData => {
  const tldrawData = getTLDataTemplate({
    pluginVersion: plugin.manifest.version,
    tldrawFile: createRawTldrawFile(store),
    uuid: window.crypto.randomUUID(),
  });
  return tldrawData;
};