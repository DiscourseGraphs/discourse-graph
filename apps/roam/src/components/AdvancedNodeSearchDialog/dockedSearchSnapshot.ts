import type { SearchResult } from "./utils";

export const isDockedSnapshot = ({
  debouncedSearchTerm,
  dockedQuery,
  dockedResults,
}: {
  debouncedSearchTerm: string;
  dockedQuery?: string;
  dockedResults?: SearchResult[];
}): boolean =>
  dockedQuery !== undefined &&
  debouncedSearchTerm.trim() === dockedQuery.trim() &&
  !!dockedResults?.length;
