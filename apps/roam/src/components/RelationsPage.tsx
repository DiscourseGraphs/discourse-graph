import React, { useEffect, useState } from "react";
import {
  Button,
  Classes,
  HTMLSelect,
  InputGroup,
  Spinner,
  Tag,
} from "@blueprintjs/core";
import {
  loadRelationRows,
  selectRelationRows,
  type RelationEndpoint,
  type RelationRow,
  type RelationSort,
} from "./relationsPageData";

const PAGE_SIZE = 25;
const SORT_LABELS: Record<RelationSort, string> = {
  type: "Type",
  source: "Source",
  destination: "Destination",
  createdAt: "Date created",
};
const EndpointLink = ({
  endpoint,
}: {
  endpoint: RelationEndpoint;
}): React.JSX.Element => (
  <button
    type="button"
    className="bp3-button bp3-minimal bp3-intent-primary dg-relation-link"
    disabled={!endpoint.exists}
    title={
      endpoint.exists
        ? `${endpoint.text} (Shift-click to open in sidebar)`
        : `Missing node: ${endpoint.uid || "no UID"}`
    }
    onClick={(event) => {
      if (event.shiftKey) {
        void window.roamAlphaAPI.ui.rightSidebar.addWindow({
          // @ts-expect-error - Roam outline windows use block-uid, unlike the upstream type.
          window: {
            type: endpoint.isPage ? "outline" : "block",
            "block-uid": endpoint.uid,
          },
        });
      } else if (endpoint.isPage) {
        void window.roamAlphaAPI.ui.mainWindow.openPage({
          page: { uid: endpoint.uid },
        });
      } else {
        void window.roamAlphaAPI.ui.mainWindow.openBlock({
          block: { uid: endpoint.uid },
        });
      }
    }}
  >
    {endpoint.text}
  </button>
);

const RelationsPage = ({
  pageUid,
  onRowsLoaded,
}: {
  pageUid: string;
  onRowsLoaded: (uids: string[]) => void;
}): React.JSX.Element => {
  const [rows, setRows] = useState<RelationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<RelationSort>("type");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    void loadRelationRows(pageUid)
      .then((nextRows) => {
        if (!active) return;
        setRows(nextRows);
        onRowsLoaded(nextRows.map((r) => r.uid));
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        onRowsLoaded([]);
        console.error("Could not load the relations page.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [pageUid, refresh, onRowsLoaded]);

  const visible = selectRelationRows({ rows, type, search, sort, descending });
  const lastPage = Math.max(0, Math.ceil(visible.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * PAGE_SIZE;
  const types = [
    ...new Map(rows.map((r) => [r.schemaUid, r.type])).entries(),
  ].sort((a, b) => a[1].localeCompare(b[1]));
  const changeSort = (next: RelationSort): void => {
    setDescending(next === sort ? !descending : next === "createdAt");
    setSort(next);
    setPage(0);
  };
  return (
    <section className="dg-relations-page" aria-label="Stored relations">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <strong aria-live="polite">
          Number of relations:{" "}
          {loading ? "…" : error ? "Unavailable" : rows.length}
        </strong>
        <Button
          minimal
          icon="refresh"
          text="Refresh"
          disabled={loading}
          onClick={() => setRefresh((r) => r + 1)}
        />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <InputGroup
          className="flex-1"
          aria-label="Search relations"
          leftIcon="search"
          placeholder="Search relations…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
        />
        <HTMLSelect
          aria-label="Filter by relation type"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(0);
          }}
        >
          <option value="">All types</option>
          {types
            .filter(([uid]) => uid)
            .map(([uid, label]) => (
              <option key={uid} value={uid}>
                {label} ({rows.filter((r) => r.schemaUid === uid).length})
              </option>
            ))}
        </HTMLSelect>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <HTMLSelect
          aria-label="Sort relations"
          value={sort}
          onChange={(e) => changeSort(e.target.value as RelationSort)}
          options={[
            { value: "type", label: "Sort by type" },
            { value: "source", label: "Sort by source" },
            { value: "destination", label: "Sort by destination" },
            { value: "createdAt", label: "Sort by date created" },
          ]}
        />
        <Button
          minimal
          icon={descending ? "sort-desc" : "sort-asc"}
          aria-label={descending ? "Sort ascending" : "Sort descending"}
          onClick={() => setDescending(!descending)}
        />
        {(search || type) && (
          <Button
            minimal
            text="Clear filters"
            onClick={() => {
              setSearch("");
              setType("");
              setPage(0);
            }}
          />
        )}
        <span className={Classes.TEXT_MUTED}>
          Shift-click a node to open in sidebar.
        </span>
      </div>
      {loading ? (
        <Spinner size={24} aria-label="Loading relations" />
      ) : error ? (
        <p role="alert" className="text-red-700">
          Could not load relations. Use Refresh to try again. The page blocks
          remain available below.
        </p>
      ) : !visible.length ? (
        <p className={Classes.TEXT_MUTED}>
          {rows.length
            ? "No relations match these filters."
            : "No stored relations on this page yet."}
        </p>
      ) : (
        <>
          <table className="bp3-html-table bp3-html-table-striped dg-relations-table">
            <thead>
              <tr>
                {(["type", "source", "destination", "createdAt"] as const).map(
                  (column) => (
                    <th
                      key={column}
                      scope="col"
                      aria-sort={
                        column === sort
                          ? descending
                            ? "descending"
                            : "ascending"
                          : "none"
                      }
                    >
                      <Button
                        minimal
                        text={SORT_LABELS[column]}
                        icon={
                          column === sort
                            ? descending
                              ? "sort-desc"
                              : "sort-asc"
                            : undefined
                        }
                        onClick={() => changeSort(column)}
                      />
                    </th>
                  ),
                )}
                <th scope="col">Inspect</th>
              </tr>
            </thead>
            <tbody>
              {visible.slice(start, start + PAGE_SIZE).map((row) => (
                <React.Fragment key={row.uid}>
                  <tr>
                    <td data-label="Type">
                      <Tag minimal>{row.type}</Tag>
                      {row.tentative && (
                        <span className={Classes.TEXT_MUTED}>
                          {" "}
                          Pending review
                        </span>
                      )}
                    </td>
                    <td data-label="Source">
                      <EndpointLink endpoint={row.source} />
                    </td>
                    <td data-label="Destination">
                      <EndpointLink endpoint={row.destination} />
                    </td>
                    <td data-label="Date created">
                      {row.createdAt === null ? (
                        <span className={Classes.TEXT_MUTED}>Unknown</span>
                      ) : (
                        <time
                          dateTime={new Date(row.createdAt).toISOString()}
                          title={new Date(row.createdAt).toLocaleString()}
                        >
                          {new Date(row.createdAt).toLocaleDateString(
                            undefined,
                            { year: "numeric", month: "short", day: "numeric" },
                          )}
                        </time>
                      )}
                    </td>
                    <td>
                      <Button
                        minimal
                        small
                        icon="code"
                        text={
                          expanded.has(row.uid) ? "Hide props" : "Show props"
                        }
                        aria-expanded={expanded.has(row.uid)}
                        onClick={() =>
                          setExpanded((previous) => {
                            const next = new Set(previous);
                            if (next.has(row.uid)) next.delete(row.uid);
                            else next.add(row.uid);
                            return next;
                          })
                        }
                      />
                    </td>
                  </tr>
                  {expanded.has(row.uid) && (
                    <tr>
                      <td colSpan={5} className="dg-relation-props">
                        <strong>Raw props · {row.uid}</strong>
                        <span className={Classes.TEXT_MUTED}> · Read only</span>
                        <pre>{JSON.stringify(row.props, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
          <div
            className="mt-3 flex items-center justify-between gap-2"
            aria-live="polite"
          >
            <span className={Classes.TEXT_MUTED}>
              {start + 1}–{Math.min(start + PAGE_SIZE, visible.length)} of{" "}
              {visible.length}
              {visible.length !== rows.length
                ? ` matching (${rows.length} total)`
                : " relations"}
            </span>
            <div className="flex gap-2">
              <Button
                minimal
                icon="chevron-left"
                aria-label="Previous relations"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              />
              <Button
                minimal
                icon="chevron-right"
                aria-label="Next relations"
                disabled={currentPage === lastPage}
                onClick={() => setPage(currentPage + 1)}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default RelationsPage;
