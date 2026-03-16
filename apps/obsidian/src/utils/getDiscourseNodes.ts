import type { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { QueryEngine } from "~/services/QueryEngine";
import { ensureNodeInstanceId } from "./nodeInstanceId";

export type DiscourseNodeInVault = {
  file: TFile;
  frontmatter: Record<string, unknown>;
  nodeTypeId: string;
  nodeInstanceId: string;
};

/**
 * Collect all discourse nodes from the vault.
 * Uses DataCore when available; falls back to vault iteration otherwise.
 * When includeImported is false (default), excludes files with importedFromRid/importedFromSpaceUri.
 */
export const collectDiscourseNodesFromVault = async (
  plugin: DiscourseGraphPlugin,
  includeImported?: boolean,
): Promise<DiscourseNodeInVault[]> => {
  const queryEngine = new QueryEngine(plugin.app);
  const excludeImported = includeImported !== true;
  const files = queryEngine.getFilesWithNodeTypeId({
    excludeImported,
  });
  const dgNodes: DiscourseNodeInVault[] = [];

  for (const file of files) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    if (!frontmatter?.nodeTypeId) continue;

    const nodeTypeId = frontmatter.nodeTypeId as string;
    if (!nodeTypeId) continue;

    const nodeInstanceId = await ensureNodeInstanceId(
      plugin,
      file,
      frontmatter as Record<string, unknown>,
    );

    dgNodes.push({
      file,
      frontmatter: frontmatter as Record<string, unknown>,
      nodeTypeId,
      nodeInstanceId,
    });
  }

  return dgNodes;
};
