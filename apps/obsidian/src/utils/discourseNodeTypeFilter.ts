import { DiscourseNode } from "~/types";

/**
 * Node type filtering for the search modal. An empty `selectedTypeIds` means no
 * filter, matching `filterCandidatesByNodeTypeIds` in QueryEngine — so nothing
 * checked shows every node, and checking a type narrows results to it.
 * Ported from Roam's advanced search so both apps filter alike.
 */

/** Type count above which the panel adds a search box; the modal is desktop-only. */
export const NODE_TYPE_FILTER_SEARCH_THRESHOLD = 7;

export const hasActiveTypeFilter = (selectedTypeIds: string[]): boolean =>
  selectedTypeIds.length > 0;

export const filterNodeTypesByQuery = (
  nodeTypes: DiscourseNode[],
  query: string,
): DiscourseNode[] => {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) return nodeTypes;

  return nodeTypes.filter((nodeType) =>
    nodeType.name.toLowerCase().includes(trimmedQuery),
  );
};
