import type { SharedNode } from "@repo/database/lib/sharedNodes";

export type SharedNodeSortColumn = "spaceName" | "title" | "lastModified";

export type SharedNodeSort = {
  column: SharedNodeSortColumn;
  direction: "ascending" | "descending";
};

type SortableSharedNode = Pick<SharedNode, SharedNodeSortColumn>;

export const DEFAULT_SHARED_NODE_SORT: SharedNodeSort = {
  column: "lastModified",
  direction: "descending",
};

export const getNextSharedNodeSort = ({
  currentSort,
  column,
}: {
  currentSort: SharedNodeSort;
  column: SharedNodeSortColumn;
}): SharedNodeSort => ({
  column,
  direction:
    currentSort.column === column && currentSort.direction === "descending"
      ? "ascending"
      : "descending",
});

const compareByColumn =
  (column: SharedNodeSortColumn) =>
  (left: SortableSharedNode, right: SortableSharedNode): number =>
    column === "lastModified"
      ? Date.parse(left.lastModified) - Date.parse(right.lastModified)
      : left[column].localeCompare(right[column], undefined, {
          numeric: true,
          sensitivity: "base",
        });

export const sortSharedNodes = <T extends SortableSharedNode>({
  nodes,
  sort,
}: {
  nodes: readonly T[];
  sort: SharedNodeSort;
}): T[] => {
  const compare = compareByColumn(sort.column);
  return [...nodes].sort((left, right) =>
    sort.direction === "ascending"
      ? compare(left, right)
      : compare(right, left),
  );
};
