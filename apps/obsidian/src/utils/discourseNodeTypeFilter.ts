import { DiscourseNode } from "~/types";

/**
 * Node type filtering for the search modal. An empty `selectedTypeIds` means no
 * filter, matching `filterCandidatesByNodeTypeIds` in QueryEngine — so "nothing
 * selected" and "every type selected" are the same state and both show all nodes.
 * Ported from Roam's advanced search so both apps filter alike.
 */

/** Type count above which the panel adds a search box; the modal is desktop-only. */
export const NODE_TYPE_FILTER_SEARCH_THRESHOLD = 7;

export const hasActiveTypeFilter = ({
  selectedTypeIds,
  allTypeIds,
}: {
  selectedTypeIds: string[];
  allTypeIds: string[];
}): boolean =>
  selectedTypeIds.length > 0 && selectedTypeIds.length < allTypeIds.length;

/** Shows no-filter as every row checked, so the panel is never an empty checklist. */
export const toPanelSelectedIds = ({
  selectedTypeIds,
  allTypeIds,
}: {
  selectedTypeIds: string[];
  allTypeIds: string[];
}): string[] => (selectedTypeIds.length === 0 ? allTypeIds : selectedTypeIds);

/** Collapses both "all checked" and "none checked" back to no filter. */
export const fromPanelSelectedIds = ({
  panelSelectedIds,
  allTypeIds,
}: {
  panelSelectedIds: string[];
  allTypeIds: string[];
}): string[] => {
  if (
    panelSelectedIds.length === 0 ||
    panelSelectedIds.length === allTypeIds.length
  ) {
    return [];
  }
  return panelSelectedIds;
};

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
