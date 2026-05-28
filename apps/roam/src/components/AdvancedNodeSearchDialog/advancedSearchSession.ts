import type { SearchResult, SortConfig } from "./utils";

export type AdvancedNodeSearchSession = {
  query: string;
  sort: SortConfig;
  results: SearchResult[];
};
