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

    const searchResults = this.dv
      .pages()
      .where(
        (p: any) =>
          p.nodeTypeId != null &&
          (this.fuzzySearch(p.file.name, query) ||
            this.fuzzySearch(p.nodeTypeId.toString(), query)),
      );

    return searchResults.values
      .map((val: any) => val.file as TFile)
      .filter((file: TFile) => !excludeFile || file.path !== excludeFile.path);
  }

  /**
   * Simple fuzzy search implementation
   * Returns true if the search term is found within the target string
   * with some tolerance for typos and partial matches
   */
  fuzzySearch(target: string, search: string): boolean {
    if (!search || !target) return false;

    const targetLower = target.toLowerCase();
    const searchLower = search.toLowerCase();

    if (searchLower.length > targetLower.length) return false;

    if (targetLower.includes(searchLower)) return true;

    let searchIndex = 0;
    for (
      let i = 0;
      i < targetLower.length && searchIndex < searchLower.length;
      i++
    ) {
      if (targetLower[i] === searchLower[searchIndex]) {
        searchIndex++;
      }
    }
    return searchIndex === searchLower.length;
  }
}
