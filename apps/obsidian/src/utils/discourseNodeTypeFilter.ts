import { DiscourseNode } from "~/types";

/**
 * Node type filtering for the search modal. An empty `selectedTypeIds` means no
 * filter, matching `filterCandidatesByNodeTypeIds` in QueryEngine — so "nothing
 * selected" and "every type selected" are the same state and both show all nodes.
 * Ported from Roam's advanced search so both apps filter alike.
 */

/** Below this many types the list is short enough to scan without a search box. */
export const NODE_TYPE_FILTER_SEARCH_THRESHOLD = 7;

export type SelectAllCheckState = "off" | "indeterminate" | "on";

export const hasActiveTypeFilter = ({
  selectedTypeIds,
  allTypeIds,
}: {
  selectedTypeIds: string[];
  allTypeIds: string[];
}): boolean =>
  selectedTypeIds.length > 0 && selectedTypeIds.length < allTypeIds.length;

/**
 * The stored empty set means "no filter", which the panel shows as every row
 * checked — otherwise an unfiltered search would render as an empty checklist.
 */
export const toPanelSelectedIds = ({
  selectedTypeIds,
  allTypeIds,
}: {
  selectedTypeIds: string[];
  allTypeIds: string[];
}): string[] => (selectedTypeIds.length === 0 ? allTypeIds : selectedTypeIds);

/**
 * Collapses both "all checked" and "none checked" back to the empty set, so the
 * count badge and the search agree that neither is a filter.
 */
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

export const getSelectAllCheckState = ({
  selectedIds,
  totalCount,
}: {
  selectedIds: string[];
  totalCount: number;
}): SelectAllCheckState => {
  if (selectedIds.length === 0) return "off";
  if (selectedIds.length === totalCount) return "on";
  return "indeterminate";
};
