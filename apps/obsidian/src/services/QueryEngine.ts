import { TFile, App } from "obsidian";
import { getAPI } from "obsidian-dataview";

export type SearchNodeOptions = {
  excludeFile?: TFile;
  minQueryLength?: number;
};

export class QueryEngine {
  private dv: any;

  constructor(app: App) {
    this.dv = getAPI(app);
  }

  /**
   * Search for nodes by title or nodeTypeId
   * @param query The search query string
   * @param options Search options including file to exclude and minimum query length
   * @returns Array of matching TFile objects
   */
  async searchNodeByTitle(
    query: string,
    options: SearchNodeOptions = {},
  ): Promise<TFile[]> {
    const { excludeFile, minQueryLength = 2 } = options;

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
        .where((p: any) => p.nodeTypeId != null).values;
      const searchResults = potentialNodes.filter((p: any) => {
        const nameMatch = this.fuzzySearch(p.file.name, query);
        const idMatch = this.fuzzySearch(p.nodeTypeId.toString(), query);

        if (nameMatch || idMatch) {
          return true;
        }
        return false;
      });

      const finalResults = searchResults
        .map((val: any) => val.file as TFile)
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
