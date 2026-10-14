import React from "react";
import { Icon } from "@blueprintjs/core";

const SortableTableHeader = ({
  label,
  direction,
  onSort,
}: {
  label: string;
  direction: "ascending" | "descending" | null;
  onSort: () => void;
}): React.ReactElement => (
  <th scope="col" aria-sort={direction ?? "none"}>
    <button type="button" className="dg-sortable-table-header" onClick={onSort}>
      {label}
      <Icon
        icon={direction === "descending" ? "sort-desc" : "sort-asc"}
        iconSize={12}
        className={direction ? undefined : "invisible"}
      />
    </button>
  </th>
);

export default SortableTableHeader;
