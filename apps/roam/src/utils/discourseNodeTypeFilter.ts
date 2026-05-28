import { type DiscourseNode } from "~/utils/getDiscourseNodes";

/* Advanced search: when `selectedTypeIds` has no values, show all node types; otherwise, filter to the selected types. */
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

export const toPopoverSelectedIds = ({
  selectedTypeIds,
  allTypeIds,
}: {
  selectedTypeIds: string[];
  allTypeIds: string[];
}): string[] => (selectedTypeIds.length === 0 ? allTypeIds : selectedTypeIds);

export const fromPopoverSelectedIds = ({
  popoverSelectedIds,
  allTypeIds,
}: {
  popoverSelectedIds: string[];
  allTypeIds: string[];
}): string[] => {
  if (
    popoverSelectedIds.length === 0 ||
    popoverSelectedIds.length === allTypeIds.length
  ) {
    return [];
  }
  return popoverSelectedIds;
};

export const filterDiscourseNodesByQuery = (
  nodes: DiscourseNode[],
  query: string,
): DiscourseNode[] => {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery) return nodes;

  return nodes.filter((node) => node.text.toLowerCase().includes(trimmedQuery));
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
