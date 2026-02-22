import type { TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { ensureNodeInstanceId } from "./nodeInstanceId";

export type DiscourseNodeInVault = {
  file: TFile;
  frontmatter: Record<string, unknown>;
  nodeTypeId: string;
  nodeInstanceId: string;
};

/**
 * Step 1: Collect all discourse nodes from the vault
 * Filters markdown files that have nodeTypeId in frontmatter
 */
export const collectDiscourseNodesFromVault = async (
  plugin: DiscourseGraphPlugin,
  includeImported?: boolean,
): Promise<DiscourseNodeInVault[]> => {
  const allFiles = plugin.app.vault.getMarkdownFiles();
  const dgNodes: DiscourseNodeInVault[] = [];

  for (const file of allFiles) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    // Not a discourse node
    if (!frontmatter?.nodeTypeId) {
      continue;
    }

    if (
      // note: importedFromSpaceUri is legacy
      (frontmatter.importedFromRid || frontmatter.importedFromSpaceUri) &&
      includeImported !== true
    ) {
      continue;
    }

    const nodeTypeId = frontmatter.nodeTypeId as string;
    if (!nodeTypeId) {
      continue;
    }

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
