import { TFile, App } from "obsidian";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type DiscourseGraphPlugin from "~/index";
import { BulkImportPattern, BulkImportCandidate, DiscourseNode } from "~/types";
import { getDiscourseNodeFormatExpression } from "~/utils/getDiscourseNodeFormatExpression";
import { extractContentFromTitle } from "~/utils/extractContentFromTitle";
import { getSpaceNameIdFromRid } from "~/utils/spaceFromRid";

// This is a workaround to get the datacore API.
// TODO: Remove once we can use datacore npm package
type AppWithPlugins = App & {
  plugins: {
    plugins: {
      [key: string]: {
        api: unknown;
      };
    };
  };
};

type DatacorePage = {
  $name: string;
  $path?: string;
};

export class QueryEngine {
  private app: App;
  private dc:
    | {
        query: (query: string) => DatacorePage[];
      }
    | undefined;
  private readonly MIN_QUERY_LENGTH = 2;

  constructor(app: App) {
    const appWithPlugins = app as AppWithPlugins;
    this.dc = appWithPlugins.plugins?.plugins?.["datacore"]?.api as
      | { query: (query: string) => DatacorePage[] }
      | undefined;
    this.app = app;
  }

  functional = () => !!this.dc;

  /**
   * Search across all discourse nodes (files that have frontmatter nodeTypeId)
   */
  searchDiscourseNodesByTitle = async (
    query: string,
    nodeTypeId?: string,
  ): Promise<TFile[]> => {
    if (!query || query.length < this.MIN_QUERY_LENGTH) {
      return [];
    }
    if (!this.dc) {
      console.warn(
        "Datacore API not available. Search functionality is not available.",
      );
      return [];
    }

    try {
      const dcQuery = nodeTypeId
        ? `@page and exists(nodeTypeId) and nodeTypeId = "${nodeTypeId}"`
        : "@page and exists(nodeTypeId)";
      const potentialNodes = await this.dc.query(dcQuery);

      const searchResults = potentialNodes.filter((p: DatacorePage) =>
        this.fuzzySearch(p.$name, query),
      );

      const files = searchResults
        .map((dcFile: DatacorePage) => {
          if (dcFile && dcFile.$path) {
            const realFile = this.app.vault.getAbstractFileByPath(dcFile.$path);
            if (realFile && realFile instanceof TFile) return realFile;
          }
          return null;
        })
        .filter((f): f is TFile => f instanceof TFile);

      return files.reverse();
    } catch (error) {
      console.error("Error in searchDiscourseNodesByTitle:", error);
      return [];
    }
  };

  /**
   * Search across all discourse nodes that have nodeInstanceId
   */
  getDiscourseNodeById = (nodeInstanceId: string): TFile | null => {
    if (!this.dc) {
      console.warn(
        "Datacore API not available. Search functionality is not available.",
      );
      return null;
    }

    if (!nodeInstanceId.match(/^[-.+\w]+$/)) {
      console.error("Malformed id:", nodeInstanceId);
      return null;
    }
    try {
      const dcQuery = `@page and exists(nodeInstanceId) and nodeInstanceId = "${nodeInstanceId}"`;
      const potentialNodes = this.dc.query(dcQuery);
      const path = potentialNodes.at(0)?.$path;
      if (!path) return null;
      return this.app.vault.getFileByPath(path);
    } catch (error) {
      console.error("Error in searchDiscourseNodeById:", error);
      return null;
    }
  };

  searchCompatibleNodeByTitle = async ({
    query,
    compatibleNodeTypeIds,
    activeFile,
    selectedRelationType,
  }: {
    query: string;
    compatibleNodeTypeIds: string[];
    activeFile: TFile;
    selectedRelationType: string;
  }): Promise<TFile[]> => {
    if (!query || query.length < this.MIN_QUERY_LENGTH) {
      return [];
    }
    if (!this.dc) {
      console.warn(
        "Datacore API not available. Search functionality is not available.",
      );
      return [];
    }

    try {
      const dcQuery = `@page and exists(nodeTypeId) and ${compatibleNodeTypeIds
        .map((id) => `nodeTypeId = "${id}"`)
        .join(" or ")}`;

      const potentialNodes = this.dc.query(dcQuery);
      const searchResults = potentialNodes.filter((p: DatacorePage) => {
        return this.fuzzySearch(p.$name, query);
      });

      let existingRelatedFiles: string[] = [];
      if (selectedRelationType) {
        const fileCache = this.app.metadataCache.getFileCache(activeFile);
        const existingRelations: string[] =
          (fileCache?.frontmatter?.[selectedRelationType] as string[]) || [];

        existingRelatedFiles = existingRelations.map((relation: string) => {
          const match = relation.match(/\[\[(.*?)(?:\|.*?)?\]\]/);
          return match?.[1] ?? relation.replace(/^\[\[|\]\]$/g, "");
        });
      }
      const finalResults = searchResults
        .map((dcFile: DatacorePage) => {
          if (dcFile && dcFile.$path) {
            const realFile = this.app.vault.getAbstractFileByPath(dcFile.$path);
            if (realFile && realFile instanceof TFile) {
              return realFile;
            }
          }
          return null;
        })
        .filter((f): f is TFile => f instanceof TFile)
        .filter((file: TFile) => {
          if (file.path === activeFile.path) return false;

          if (
            selectedRelationType &&
            existingRelatedFiles.some((existingFile) => {
              return (
                file.basename === existingFile.replace(/\.md$/, "") ||
                file.name === existingFile
              );
            })
          ) {
            return false;
          }

          return true;
        });

      return finalResults;
    } catch (error) {
      console.error("Error in searchNodeByTitle:", error);
      return [];
    }
  };

  /**
   * Enhanced fuzzy search implementation
   * Returns true if the search term is found within the target string
   * with tolerance for typos and partial matches
   */
  fuzzySearch(target: string, search: string): boolean {
    if (!search || !target) return false;

    const targetLower = target.toLowerCase();
    const searchLower = search.toLowerCase();

    if (targetLower.includes(searchLower)) {
      return true;
    }

    if (searchLower.length > targetLower.length) {
      return false;
    }

    if (targetLower.startsWith(searchLower)) {
      return true;
    }

    let searchIndex = 0;
    let consecutiveMatches = 0;
    const MIN_CONSECUTIVE = Math.min(2, searchLower.length);

    for (
      let i = 0;
      i < targetLower.length && searchIndex < searchLower.length;
      i++
    ) {
      if (targetLower[i] === searchLower[searchIndex]) {
        searchIndex++;
        consecutiveMatches++;

        if (
          consecutiveMatches >= MIN_CONSECUTIVE &&
          searchIndex >= searchLower.length * 0.7
        ) {
          return true;
        }
      } else {
        consecutiveMatches = 0;
      }
    }

    return searchIndex === searchLower.length;
  }

  async scanForBulkImportCandidates(
    patterns: BulkImportPattern[],
    validNodeTypes: DiscourseNode[],
  ): Promise<BulkImportCandidate[]> {
    const candidates: BulkImportCandidate[] = [];

    if (!this.dc) {
      console.warn(
        "Datacore API not available. Falling back to vault iteration.",
      );
      return this.fallbackScanVault(patterns, validNodeTypes);
    }

    try {
      let dcQuery: string;

      if (validNodeTypes.length === 0) {
        dcQuery = "@page";
      } else {
        const validIdConditions = validNodeTypes
          .map((nt) => `nodeTypeId != "${nt.id}"`)
          .join(" and ");

        dcQuery = `@page and (!exists(nodeTypeId) or (${validIdConditions}))`;
      }

      const potentialPages = this.dc.query(dcQuery);

      for (const page of potentialPages) {
        const fileName = page.$name;

        for (const pattern of patterns) {
          if (!pattern.enabled || !pattern.alternativePattern.trim()) continue;

          const regex = getDiscourseNodeFormatExpression(
            pattern.alternativePattern,
          );

          if (regex.test(fileName)) {
            if (!page.$path) continue;
            const file = this.app.vault.getAbstractFileByPath(page.$path);
            if (file && file instanceof TFile) {
              const extractedContent = extractContentFromTitle(
                pattern.alternativePattern,
                fileName,
              );

              const matchedNodeType = validNodeTypes.find(
                (nt) => nt.id === pattern.nodeTypeId,
              );

              if (!matchedNodeType) {
                console.warn(
                  `No matching node type found for pattern with nodeTypeId: ${pattern.nodeTypeId}`,
                );
                continue;
              }

              candidates.push({
                file,
                matchedNodeType,
                alternativePattern: pattern.alternativePattern,
                extractedContent,
                selected: true,
              });
            }
            break; // Stop checking other patterns for this file
          }
        }
      }

      return candidates;
    } catch (error) {
      console.error(
        "Error in datacore bulk scan, falling back to vault iteration:",
        error,
      );
      return this.fallbackScanVault(patterns, validNodeTypes);
    }
  }

  /**
   * Return all markdown pages under import/ that have importedFromRid and nodeInstanceId.
   * Uses DataCore when available; returns [] if DataCore is not available.
   */
  getImportedNodePages = (): TFile[] => {
    if (!this.dc) return [];
    try {
      const dcQuery = `@page and path("import") and exists(importedFromRid) and exists(nodeInstanceId)`;
      const pages = this.dc.query(dcQuery);
      const files: TFile[] = [];
      for (const page of pages) {
        if (page.$path) {
          const file = this.app.vault.getAbstractFileByPath(page.$path);
          if (file && file instanceof TFile) files.push(file);
        }
      }
      return files;
    } catch (error) {
      console.warn("DataCore query for imported nodes failed:", error);
      return [];
    }
  };

  /**
   * Find an existing imported file by nodeInstanceId and importedFromRid
   * Uses DataCore when available; falls back to vault iteration otherwise
   * Returns the file if found, null otherwise
   */
  findExistingImportedFile = (
    nodeInstanceId: string,
    importedFromRid: string,
  ): TFile | null => {
    if (this.dc) {
      try {
        const safeId = nodeInstanceId
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"');
        const safeUri = importedFromRid
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"');
        const dcQuery = `@page and nodeInstanceId = "${safeId}" and importedFromRid = "${safeUri}"`;
        const results = this.dc.query(dcQuery);

        for (const page of results) {
          if (page.$path) {
            const file = this.app.vault.getAbstractFileByPath(page.$path);
            if (file && file instanceof TFile) {
              return file;
            }
          }
        }
      } catch (error) {
        console.warn("Error querying DataCore for imported file:", error);
      }
    }

    // Fallback: DataCore absent, query failed, or indexed field mismatch
    const allFiles = this.app.vault.getMarkdownFiles();
    for (const f of allFiles) {
      const fm = this.app.metadataCache.getFileCache(f)?.frontmatter;
      if (
        fm?.nodeInstanceId === nodeInstanceId &&
        fm.importedFromRid === importedFromRid
      ) {
        return f;
      }
    }
    return null;
  };

  private async fallbackScanVault(
    patterns: BulkImportPattern[],
    validNodeTypes: DiscourseNode[],
  ): Promise<BulkImportCandidate[]> {
    const candidates: BulkImportCandidate[] = [];
    const allFiles = this.app.vault.getMarkdownFiles();

    for (const file of allFiles) {
      const fileName = file.basename;
      const fileCache = this.app.metadataCache.getFileCache(file);
      const currentNodeTypeId = fileCache?.frontmatter?.nodeTypeId;

      if (
        currentNodeTypeId &&
        validNodeTypes.some((nt) => nt.id === currentNodeTypeId)
      ) {
        continue;
      }

      for (const pattern of patterns) {
        if (!pattern.enabled || !pattern.alternativePattern.trim()) continue;

        const regex = getDiscourseNodeFormatExpression(
          pattern.alternativePattern,
        );

        if (regex.test(fileName)) {
          const extractedContent = extractContentFromTitle(
            pattern.alternativePattern,
            fileName,
          );

          const matchedNodeType = validNodeTypes.find(
            (nt) => nt.id === pattern.nodeTypeId,
          );

          if (!matchedNodeType) {
            console.warn(
              `No matching node type found for pattern with nodeTypeId: ${pattern.nodeTypeId}`,
            );
            continue;
          }

          candidates.push({
            file,
            matchedNodeType,
            alternativePattern: pattern.alternativePattern,
            extractedContent,
            selected: true,
          });
          break;
        }
      }
    }

    return candidates;
  }
}

/**
 * Returns info about imported nodes (from import/ folder only).
 * Uses DataCore to query by path and metadata when available; otherwise iterates vault.
 * - nodeKeys: "spaceId:nodeInstanceId" for each imported node
 * - keyToRid: maps "spaceId:nodeInstanceId" -> importedFromRid
 */
export const getImportedNodesInfo = async ({
  queryEngine,
  plugin,
  client,
}: {
  queryEngine?: QueryEngine;
  plugin: DiscourseGraphPlugin;
  client: DGSupabaseClient;
}): Promise<{
  nodeKeys: Set<string>;
  keyToRid: Map<string, string>;
}> => {
  const nodeKeys = new Set<string>();
  const keyToRid = new Map<string, string>();

  const files = queryEngine?.functional()
    ? queryEngine?.getImportedNodePages()
    : plugin.app.vault
        .getMarkdownFiles()
        .filter((f) => f.path.startsWith("import/"));

  for (const file of files) {
    const cache = plugin.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;
    const importedFromRid = frontmatter?.importedFromRid as string | undefined;
    const nodeInstanceId = frontmatter?.nodeInstanceId as string | undefined;

    if (!importedFromRid || !nodeInstanceId) continue;

    const { spaceId } = await getSpaceNameIdFromRid(client, importedFromRid);
    if (spaceId < 0) continue;

    const key = `${spaceId}:${nodeInstanceId}`;
    nodeKeys.add(key);
    keyToRid.set(key, importedFromRid);
  }

  return { nodeKeys, keyToRid };
};
