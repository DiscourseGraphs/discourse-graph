import { TFile, App } from "obsidian";
import { BulkImportPattern, BulkImportCandidate, DiscourseNode } from "~/types";
import { getDiscourseNodeFormatExpression } from "~/utils/getDiscourseNodeFormatExpression";
import { extractContentFromTitle } from "~/utils/extractContentFromTitle";

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
   * Find an existing imported file by nodeInstanceId and importedFromSpaceId
   * Returns the file if found, null otherwise
   */
  findExistingImportedFile = (
    nodeInstanceId: string,
    importedFromSpaceId: number,
  ): TFile | null => {
    if (this.dc) {
      try {
        const dcQuery = `@page and nodeInstanceId = "${nodeInstanceId}" and importedFromSpaceId = ${importedFromSpaceId}`;
        const results = this.dc.query(dcQuery);

        for (const page of results) {
          if (page.$path) {
            const file = this.app.vault.getAbstractFileByPath(page.$path);
            if (file && file instanceof TFile) {
              return file;
            }
          }
        }
        return null;
      } catch (error) {
        console.warn("Error querying DataCore for imported file:", error);
        return null;
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
