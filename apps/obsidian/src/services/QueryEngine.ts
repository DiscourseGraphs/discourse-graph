import { TFile, App } from "obsidian";
import { getAPI } from "obsidian-dataview";

interface AppWithPlugins extends App {
  plugins: {
    plugins: {
      [key: string]: {
        api: any;
      };
    };
  };
}

export class QueryEngine {
  private app: App;
  private dc: any;

  constructor(app: App) {
    const appWithPlugins = app as AppWithPlugins;
    this.dc = appWithPlugins.plugins?.plugins?.["datacore"]?.api;
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
    if (!this.dc) {
      console.warn(
        "Datacore API not available. Search functionality is limited.",
      );
      return [];
    }

    try {
      const dcQuery = `@page and exists(nodeTypeId) and ${compatibleNodeTypeIds
        .map((id) => `nodeTypeId = "${id}"`)
        .join(" or ")}`;

      const potentialNodes = this.dc.query(dcQuery);
      const searchResults = potentialNodes.filter((p: any) => {
        return this.fuzzySearch(p.$name, query);
      });
      const finalResults = searchResults
        .map((dcFile: any) => {
          if (dcFile && dcFile.$path) {
            const realFile = this.app.vault.getAbstractFileByPath(dcFile.$path);
            if (realFile && realFile instanceof TFile) {
              return realFile;
            }
          }
          return dcFile as TFile;
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
