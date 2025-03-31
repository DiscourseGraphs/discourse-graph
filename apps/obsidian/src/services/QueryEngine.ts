import { TFile, App } from "obsidian";
import { getAPI } from "obsidian-dataview";

export class QueryEngine {
  private dv: any;
  private app: App;

  constructor(app: App) {
    // TODO: replace this with datacore when the npm is ready
    this.dv = getAPI(app);
    this.app = app;
  }

  async searchCompatibleNodeByTitle(
    query: string,
    minQueryLength: number = 2,
    compatibleNodeTypeIds: string[],
    excludeFile?: TFile,
  ): Promise<TFile[]> {
    if (!query || query.length < minQueryLength) {
      return [];
    }
    if (!this.dv) {
      console.warn(
        "Dataview API not available. Search functionality is limited.",
      );
      return [];
    }

    try {
      const potentialNodes = this.dv
        .pages()
        .where(
          (p: any) =>
            p.nodeTypeId != null &&
            compatibleNodeTypeIds.includes(p.nodeTypeId),
        ).values;

      const searchResults = potentialNodes.filter((p: any) => {
        return this.fuzzySearch(p.file.name, query);
      });

      const finalResults = searchResults
        .map((val: any) => {
          const dataviewFile = val.file;

          if (dataviewFile && dataviewFile.path) {
            const realFile = this.app.vault.getAbstractFileByPath(
              dataviewFile.path,
            );
            if (realFile && realFile instanceof TFile) {
              return realFile;
            }
          }
          return dataviewFile as TFile;
        })
        .filter(
          (file: TFile) => !excludeFile || file.path !== excludeFile.path,
        );

      return finalResults;
    } catch (error) {
      console.error("Error in searchNodeByTitle:", error);
      return [];
    }
  }

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
}
