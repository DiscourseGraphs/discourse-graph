import { TFile, App } from "obsidian";
import { BulkImportPattern, BulkImportCandidate, DiscourseNode } from "~/types";
import { getDiscourseNodeFormatExpression } from "~/utils/getDiscourseNodeFormatExpression";
import { extractContentFromTitle } from "~/utils/extractContentFromTitle";
import { Datacore, DatacoreApi, Settings } from "@blacksmithgu/datacore";

type DatacorePage = {
  $name: string;
  $path?: string;
};

// Default datacore settings
const DEFAULT_DATACORE_SETTINGS: Settings = {
  importerNumThreads: 4,
  importerUtilization: 0.5,
  enableJs: false,
  defaultPagingEnabled: true,
  defaultPageSize: 50,
  scrollOnPageChange: true,
  maxRecursiveRenderDepth: 4,
  defaultDateFormat: "MMMM dd, yyyy",
  defaultDateTimeFormat: "h:mm a - MMMM dd, yyyy",
  renderNullAs: "-",
  indexInlineFields: false,
};

export class QueryEngine {
  private app: App;
  private dc: DatacoreApi | undefined;
  private readonly MIN_QUERY_LENGTH = 2;
  private datacoreCore: Datacore | undefined;
  private initializationPromise: Promise<void> | undefined;

  constructor(app: App) {
    this.app = app;
    this.initializeDatacore();
  }

  private async initializeDatacore(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise<void>((resolve) => {
      try {
        // Create datacore instance with version and settings
        this.datacoreCore = new Datacore(
          this.app,
          "0.1.0", // Version
          DEFAULT_DATACORE_SETTINGS,
        );

        // Set up initialization listener
        const timeoutId = setTimeout(() => {
          console.warn(
            "Datacore initialization timeout - falling back to vault scanning",
          );
          resolve();
        }, 10000); // 10 second timeout

        this.datacoreCore.on("initialized", () => {
          clearTimeout(timeoutId);
          if (this.datacoreCore) {
            this.dc = new DatacoreApi(this.datacoreCore);
            console.log("Datacore initialized successfully");
          }
          resolve();
        });

        // Start initialization
        this.datacoreCore.initialize();
      } catch (error) {
        console.error("Failed to initialize datacore:", error);
        resolve();
      }
    });

    return this.initializationPromise;
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
    }
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

    await this.ensureInitialized();

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
      const potentialNodes = this.dc.query(dcQuery);

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

    await this.ensureInitialized();

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

    await this.ensureInitialized();

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

  /**
   * Cleanup method to properly unload datacore
   */
  cleanup(): void {
    if (this.datacoreCore) {
      this.datacoreCore.unload();
      this.datacoreCore = undefined;
      this.dc = undefined;
    }
  }
}
