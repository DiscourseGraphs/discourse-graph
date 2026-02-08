import { uuidv7 } from "uuidv7";
import type { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";

/**
 * Ensures the file has a nodeInstanceId in frontmatter. If missing, generates one (uuidv7) and writes it.
 * Used by sync and relations store so every discourse node has a stable instance id.
 */
export const ensureNodeInstanceId = async (
  plugin: DiscourseGraphPlugin,
  file: TFile,
  frontmatter: Record<string, unknown>,
): Promise<string> => {
  const existingId = frontmatter["nodeInstanceId"] as string | undefined;
  if (existingId && typeof existingId === "string") {
    return existingId;
  }

  const nodeInstanceId = uuidv7() as string;
  await plugin.app.fileManager.processFrontMatter(file, (fm) => {
    (fm as Record<string, unknown>).nodeInstanceId = nodeInstanceId;
  });

  return nodeInstanceId;
};
