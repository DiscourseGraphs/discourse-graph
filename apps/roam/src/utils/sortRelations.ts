export type RelationSortColumn = "source" | "relation" | "destination";

export type RelationSort = {
  column: RelationSortColumn;
  direction: "ascending" | "descending";
};

export const getNextRelationSort = ({
  currentSort,
  column,
}: {
  currentSort: RelationSort | null;
  column: RelationSortColumn;
}): RelationSort | null => {
  if (currentSort?.column !== column) {
    return { column, direction: "ascending" };
  }

  if (currentSort.direction === "ascending") {
    return { column, direction: "descending" };
  }

  return null;
};

type SortableRelation = {
  source: string | undefined;
  text: string;
  destination: string | undefined;
};

const getRelationSortValue = ({
  relation,
  column,
  labelsByType,
}: {
  relation: SortableRelation;
  column: RelationSortColumn;
  labelsByType: Readonly<Record<string, { label: string }>>;
}): string => {
  if (column === "relation") return relation.text;

  return labelsByType[relation[column] || ""]?.label || "";
};

export const sortRelations = <T extends SortableRelation>({
  relations,
  sort,
  labelsByType,
}: {
  relations: readonly T[];
  sort: RelationSort;
  labelsByType: Readonly<Record<string, { label: string }>>;
}): T[] =>
  [...relations].sort((a, b) => {
    const comparison = getRelationSortValue({
      relation: a,
      column: sort.column,
      labelsByType,
    }).localeCompare(
      getRelationSortValue({
        relation: b,
        column: sort.column,
        labelsByType,
      }),
      undefined,
      { numeric: true, sensitivity: "base" },
    );

    return sort.direction === "ascending" ? comparison : -comparison;
  });
