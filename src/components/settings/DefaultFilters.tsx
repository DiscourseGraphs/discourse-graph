import { Button, Intent, InputGroup } from "@blueprintjs/core";
import React, { useEffect, useState } from "react";
import type { OnloadArgs } from "roamjs-components/types";
import type { Filters } from "roamjs-components/components/Filter";

//
// TODO - REWORK THIS COMPONENT
//
export type StoredFilters = {
  includes: { values: string[] };
  excludes: { values: string[] };
};

const Filter = ({
  column,
  data,
  onFilterAdd,
  onFilterRemove,
  onRemove,
}: {
  column: string;
  data: Filters;
  onFilterAdd: (args: { text: string; type: "includes" | "excludes" }) => void;
  onFilterRemove: (args: {
    text: string;
    type: "includes" | "excludes";
  }) => void;
  onRemove: () => void;
}) => {
  const [newFilter, setNewFilter] = useState("");
  return (
    <div
      style={{
        borderRadius: 4,
        border: "1px dashed #EEEEEE",
        marginBottom: 8,
        padding: 8,
      }}
    >
      <h4>{column}</h4>
      <div style={{ display: "flex" }}>
        <ul style={{ width: "50%" }}>
          {Array.from(data.includes.values || new Set<string>()).map((v) => (
            <li
              key={v}
              onClick={() => onFilterRemove({ text: v, type: "includes" })}
              style={{ cursor: "pointer" }}
            >
              {v}
            </li>
          ))}
        </ul>
        <ul style={{ width: "50%" }}>
          {Array.from(data.excludes.values || new Set<string>()).map((v) => (
            <li
              key={v}
              onClick={() => onFilterRemove({ text: v, type: "excludes" })}
              style={{ cursor: "pointer" }}
            >
              {v}
            </li>
          ))}
        </ul>
      </div>
      <div className="justify-end items-center flex gap-1">
        <InputGroup
          style={{ minWidth: "initial" }}
          value={newFilter}
          onChange={(e) => setNewFilter(e.target.value)}
        />
        <div
          className="items-center gap-1 flex-shrink-0"
          style={{ display: "flex" }}
        >
          <Button
            icon={"plus"}
            intent={Intent.SUCCESS}
            onClick={() => {
              onFilterAdd({ text: newFilter, type: "includes" });
              setNewFilter("");
            }}
          />
          <Button
            icon={"cross"}
            intent={Intent.WARNING}
            onClick={() => {
              onFilterAdd({ text: newFilter, type: "excludes" });
              setNewFilter("");
            }}
          />
          <Button icon={"trash"} onClick={onRemove} minimal />
        </div>
      </div>
    </div>
  );
};

const DefaultFilters = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const [newColumn, setNewColumn] = useState("");
  const [filters, setFilters] = useState(() =>
    Object.fromEntries(
      Object.entries(
        (extensionAPI.settings.get("default-filters") as Record<
          string,
          StoredFilters
        >) || {}
      ).map(([k, v]) => [
        k,
        {
          includes: Object.fromEntries(
            Object.entries(v.includes || {}).map(([k, v]) => [k, new Set(v)])
          ),
          excludes: Object.fromEntries(
            Object.entries(v.excludes || {}).map(([k, v]) => [k, new Set(v)])
          ),
        },
      ])
    )
  );

  useEffect(() => {
    extensionAPI.settings.set(
      "default-filters",
      Object.fromEntries(
        Object.entries(filters).map(([k, v]) => [
          k,
          {
            includes: Object.fromEntries(
              Object.entries(v.includes || {}).map(([k, v]) => [
                k,
                Array.from(v),
              ])
            ),
            excludes: Object.fromEntries(
              Object.entries(v.excludes || {}).map(([k, v]) => [
                k,
                Array.from(v),
              ])
            ),
          },
        ])
      )
    );
  }, [filters]);
  return (
    <div
      style={{
        minWidth: 256,
      }}
    >
      {Object.entries(filters).map(([column, data]) => (
        <Filter
          column={column}
          key={column}
          data={data}
          onFilterAdd={({ text, type }) => {
            data[type].values.add(text);
            const newFilters = {
              ...filters,
            };
            setFilters(newFilters);
          }}
          onFilterRemove={({ text, type }) => {
            data[type].values.delete(text);
            const newFilters = {
              ...filters,
            };
            setFilters(newFilters);
          }}
          onRemove={() => {
            const newFilters = Object.fromEntries(
              Object.entries(filters).filter(([col]) => col !== column)
            );
            setFilters(newFilters);
          }}
        />
      ))}
      <div className="flex justify-end items-center gap-2">
        <InputGroup
          style={{ minWidth: "initial" }}
          value={newColumn}
          onChange={(e) => setNewColumn(e.target.value)}
        />
        <Button
          icon={"add"}
          intent={Intent.PRIMARY}
          disabled={!newColumn}
          onClick={() => {
            const newFilters = {
              ...filters,
              [newColumn]: {
                includes: { values: new Set<string>() },
                excludes: { values: new Set<string>() },
              },
            };
            setFilters(newFilters);
            // extensionAPI.settings.set("default-filters", newFilters);
            setNewColumn("");
          }}
        />
      </div>
    </div>
  );
};

export default DefaultFilters;
