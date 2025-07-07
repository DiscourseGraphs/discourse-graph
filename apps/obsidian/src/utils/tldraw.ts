import { createTLStore, TldrawFile, TLStore } from "tldraw";
import {
  FRONTMATTER_KEY,
  TLDATA_DELIMITER_END,
  TLDATA_DELIMITER_START,
  TLDRAW_VERSION,
} from "../constants";

export type TldrawPluginMetaData = {
  "plugin-version": string;
  "tldraw-version": string;
  uuid: string;
};

export type TLData = {
  meta: TldrawPluginMetaData;
  raw: any; // Using any for now, we'll type this properly later
};

export function createRawTldrawFile(store?: TLStore): TldrawFile {
  store ??= createTLStore();
  return {
    tldrawFileFormatVersion: 1,
    schema: store.schema.serialize(),
    records: store.allRecords(),
  };
}

export function getTLMetaTemplate(
  pluginVersion: string,
  uuid: string = window.crypto.randomUUID(),
): TldrawPluginMetaData {
  return {
    uuid,
    "plugin-version": pluginVersion,
    "tldraw-version": TLDRAW_VERSION,
  };
}

export function getTLDataTemplate(
  pluginVersion: string,
  tldrawFile: TldrawFile,
  uuid: string,
): TLData {
  return {
    meta: getTLMetaTemplate(pluginVersion, uuid),
    raw: tldrawFile,
  };
}

export function frontmatterTemplate(data: string, tags: string[] = []) {
  let str = "---\n";
  str += `${data}\n`;
  if (tags.length) {
    str += `tags:\n[${tags.join(", ")}]\n`;
  }
  str += "---\n";
  return str;
}

export function codeBlockTemplate(data: TLData) {
  let str = "```json" + ` ${TLDATA_DELIMITER_START}`;
  str += "\n";
  str += `${JSON.stringify(data, null, "\t")}\n`;
  str += `${TLDATA_DELIMITER_END}\n`;
  str += "```";
  return str;
}

export function tlFileTemplate(frontmatter: string, codeblock: string) {
  return `${frontmatter}\n\n${codeblock}`;
}

export function createEmptyTldrawContent(
  pluginVersion: string,
  tags: string[] = [],
): string {
  const tldrawFile = createRawTldrawFile();
  const tlData = getTLDataTemplate(
    pluginVersion,
    tldrawFile,
    window.crypto.randomUUID(),
  );
  console.log("tlData", tlData);
  const frontmatter = frontmatterTemplate(`${FRONTMATTER_KEY}: true`, tags);
  const codeblock = codeBlockTemplate(tlData);
  return tlFileTemplate(frontmatter, codeblock);
}
