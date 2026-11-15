import type { DbCrossAppNode } from "@repo/database/lib/dbToCrossAppConverters";
import {
  getSharedNodeSpace,
  type SharedNodeListing,
} from "@repo/database/lib/sharedNodes";

export type SharedNodeSortColumn = "spaceName" | "title" | "lastModified";

export type SharedNodeSort = {
  column: SharedNodeSortColumn;
  direction: "ascending" | "descending";
};

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

const getSortText = ({
  node,
  column,
  spaces,
}: {
  node: DbCrossAppNode;
  column: Exclude<SharedNodeSortColumn, "lastModified">;
  spaces: SharedNodeListing["spaces"];
}): string =>
  column === "spaceName"
    ? getSharedNodeSpace({ node, spaces }).name
    : node.content.direct.value;

const compareByColumn =
  ({
    column,
    spaces,
  }: {
    column: SharedNodeSortColumn;
    spaces: SharedNodeListing["spaces"];
  }) =>
  (left: DbCrossAppNode, right: DbCrossAppNode): number =>
    column === "lastModified"
      ? left.modifiedAt.getTime() - right.modifiedAt.getTime()
      : getSortText({ node: left, column, spaces }).localeCompare(
          getSortText({ node: right, column, spaces }),
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        );

export const sortSharedNodes = ({
  nodes,
  spaces,
  sort,
}: {
  nodes: readonly DbCrossAppNode[];
  spaces: SharedNodeListing["spaces"];
  sort: SharedNodeSort;
}): DbCrossAppNode[] => {
  const compare = compareByColumn({ column: sort.column, spaces });
  return [...nodes].sort((left, right) =>
    sort.direction === "ascending"
      ? compare(left, right)
      : compare(right, left),
  );
};
