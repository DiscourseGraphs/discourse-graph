import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Classes,
  HTMLSelect,
  HTMLTable,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  Position,
  Spinner,
  Tag,
} from "@blueprintjs/core";
import { RenderRoamBlockString } from "~/utils/roamReactComponents";
import SortableTableHeader from "./SortableTableHeader";
import { useRelationRows } from "./useRelationRows";
import {
  EMPTY_RELATION_FILTERS,
  getRelationFilterOptions,
  selectRelationRows,
  type RelationEndpoint,
  type RelationFilters,
  type RelationSort,
} from "./relationsPageData";

const SORT_LABELS: Record<RelationSort, string> = {
  source: "Source",
  type: "Relation",
  destination: "Destination",
  createdAt: "Created",
};
const FILTER_LABELS: Record<keyof RelationFilters, string> = {
  type: "Relation type",
  nodeType: "Node type",
  status: "Status",
};
const MAX_PAGE_SIZE = 100;

const EndpointLink = ({
  endpoint,
}: {
  endpoint: RelationEndpoint;
}): React.JSX.Element => (
  <button
    type="button"
    className="bp3-button bp3-minimal bp3-intent-primary dg-relation-link"
    disabled={!endpoint.exists}
    aria-label={`Open ${endpoint.text}`}
    title={
      endpoint.exists
        ? `${endpoint.text}\nClick to open · Shift-click for sidebar`
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
    {/* Native text can contain links; the endpoint button owns navigation. */}
    <span className="dg-relation-node-preview" {...{ inert: "" }}>
      <RenderRoamBlockString string={endpoint.text} />
    </span>
  </button>
);

const RelationsPage = ({
  pageUid,
  onRowsLoaded,
  onVisibilityChange,
}: {
  pageUid: string;
  onRowsLoaded: (uids: string[] | null) => void;
  onVisibilityChange: (visible: boolean) => void;
}): React.JSX.Element => {
  const { rows, loading, error, refresh } = useRelationRows({
    pageUid,
    onRowsLoaded,
  });
  const [filters, setFilters] = useState<RelationFilters>(
    EMPTY_RELATION_FILTERS,
  );
  const [search, setSearch] = useState("");
  const [uiVisible, setUiVisible] = useState(true);
  const [sort, setSort] = useState<RelationSort>("type");
  const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [pageSizeInput, setPageSizeInput] = useState("25");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const viewport = useRef<HTMLDivElement>(null);
  const options = useMemo(() => getRelationFilterOptions(rows), [rows]);
  const visible = useMemo(
    () => selectRelationRows({ rows, ...filters, search, sort, descending }),
    [rows, filters, search, sort, descending],
  );
  const lastPage = Math.max(0, Math.ceil(visible.length / pageSize) - 1);
  useEffect(() => {
    setPage((previous) => Math.min(previous, lastPage));
  }, [lastPage]);
  const currentPage = Math.min(page, lastPage);
  const start = currentPage * pageSize;
  const filterCount = Object.values(filters).filter(Boolean).length;
  const resetPage = (): void => {
    setPage(0);
    viewport.current?.scrollTo({ top: 0 });
  };
  const changeSort = (next: RelationSort): void => {
    setDescending(next === sort ? !descending : next === "createdAt");
    setSort(next);
    resetPage();
  };
  const clearFilters = (): void => {
    setFilters(EMPTY_RELATION_FILTERS);
    resetPage();
  };

  return (
    <section className="dg-relations-page" aria-label="Stored relations">
      <div className="dg-relations-heading">
        <strong>
          Relations <span className={Classes.TEXT_MUTED}>({rows.length})</span>
        </strong>
        <span className={Classes.TEXT_MUTED} role="status">
          {uiVisible && (loading ? "Updating…" : error ? "Update failed" : "")}
        </span>
        <Button
          minimal
          small
          icon={uiVisible ? "eye-off" : "eye-open"}
          text={uiVisible ? "Hide UI" : "Show UI"}
          aria-expanded={uiVisible}
          title={
            uiVisible
              ? "Show the underlying blocks"
              : "Show the relations browser"
          }
          onClick={() => {
            const visible = !uiVisible;
            setUiVisible(visible);
            onVisibilityChange(visible);
          }}
        />
      </div>
      {uiVisible && (
        <>
          <div className="dg-relations-toolbar">
            <InputGroup
              className="dg-relations-search"
              aria-label="Search relations"
              leftIcon="search"
              placeholder="Search relations…"
              value={search}
              rightElement={
                <Button
                  minimal
                  small
                  icon="cross"
                  aria-label="Clear search"
                  disabled={!search}
                  onClick={() => {
                    setSearch("");
                    resetPage();
                  }}
                />
              }
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
            />
            <Popover
              position={Position.BOTTOM_RIGHT}
              minimal
              content={
                <div
                  className="dg-relations-filters"
                  aria-label="Relation filters"
                >
                  {(
                    Object.keys(FILTER_LABELS) as (keyof RelationFilters)[]
                  ).map((key) => (
                    <label className={Classes.LABEL} key={key}>
                      {FILTER_LABELS[key]}
                      <HTMLSelect
                        fill
                        aria-label={FILTER_LABELS[key]}
                        value={filters[key]}
                        onChange={(event) => {
                          setFilters({ ...filters, [key]: event.target.value });
                          resetPage();
                        }}
                        options={[
                          {
                            value: "",
                            label:
                              key === "status" ? "All statuses" : "All types",
                          },
                          ...options[key],
                          ...(filters[key] &&
                          !options[key].some(
                            (option) => option.value === filters[key],
                          )
                            ? [
                                {
                                  value: filters[key],
                                  label:
                                    key === "status"
                                      ? "Selected status (0)"
                                      : "Selected type (0)",
                                },
                              ]
                            : []),
                        ]}
                      />
                    </label>
                  ))}
                  <p className={Classes.TEXT_MUTED}>
                    Matches either end of the relation.
                  </p>
                  <Button
                    minimal
                    icon="reset"
                    text="Clear filters"
                    disabled={!filterCount}
                    onClick={clearFilters}
                  />
                </div>
              }
            >
              <Button
                icon="filter"
                active={Boolean(filterCount)}
                text={filterCount ? `Filters (${filterCount})` : "Filters"}
                aria-label="Filter relations"
                className="dg-relations-filter-button"
              />
            </Popover>
            <span className="dg-relations-compact-sort">
              <Popover
                minimal
                position={Position.BOTTOM_RIGHT}
                content={
                  <Menu aria-label="Sort relations">
                    {(Object.keys(SORT_LABELS) as RelationSort[]).map((key) => (
                      <MenuItem
                        key={key}
                        text={SORT_LABELS[key]}
                        icon={
                          key === sort
                            ? descending
                              ? "sort-desc"
                              : "sort-asc"
                            : "blank"
                        }
                        onClick={() => changeSort(key)}
                      />
                    ))}
                  </Menu>
                }
              >
                <Button
                  minimal
                  icon="sort"
                  aria-label={`Sort by ${SORT_LABELS[sort]}, ${descending ? "descending" : "ascending"}`}
                  title={`Sort by ${SORT_LABELS[sort]}`}
                />
              </Popover>
            </span>
            <Button
              minimal
              icon="refresh"
              aria-label="Refresh relations"
              title="Refresh relations"
              disabled={loading}
              onClick={refresh}
            />
          </div>
          {error && (
            <p role="alert" className="text-red-700">
              Could not update relations. Refresh to try again. Storage blocks
              remain available below.
            </p>
          )}
          <div
            className={`dg-relations-frame ${Classes.CARD}`}
            ref={viewport}
            aria-busy={loading}
          >
            <HTMLTable className="dg-relations-table">
              <colgroup>
                <col />
                <col className="dg-relation-type-column" />
                <col />
                <col className="dg-relation-date-column" />
                <col className="dg-relation-inspect-column" />
              </colgroup>
              <thead className={Classes.CARD}>
                <tr>
                  {(
                    ["source", "type", "destination", "createdAt"] as const
                  ).map((column) => (
                    <SortableTableHeader
                      key={column}
                      label={SORT_LABELS[column]}
                      direction={
                        column === sort
                          ? descending
                            ? "descending"
                            : "ascending"
                          : null
                      }
                      onSort={() => changeSort(column)}
                    />
                  ))}
                  <th scope="col" aria-label="Inspect" />
                </tr>
              </thead>
              <tbody>
                {!visible.length ? (
                  <tr className="dg-relations-empty">
                    <td colSpan={5}>
                      {loading ? (
                        <Spinner size={22} aria-label="Loading relations" />
                      ) : error ? (
                        "Relations unavailable"
                      ) : rows.length ? (
                        "No relations match your search and filters."
                      ) : (
                        "No stored relations yet."
                      )}
                    </td>
                  </tr>
                ) : (
                  visible.slice(start, start + pageSize).map((row) => (
                    <React.Fragment key={row.uid}>
                      <tr
                        className={`dg-relation-row ${Classes.DIVIDER}`}
                        data-relation-uid={row.uid}
                      >
                        <td className="dg-relation-source">
                          <EndpointLink endpoint={row.source} />
                        </td>
                        <td className="dg-relation-type">
                          <Tag minimal>{row.type}</Tag>
                          {row.tentative && (
                            <span
                              className={`dg-relation-pending ${Classes.TEXT_MUTED}`}
                              title="This relation is pending review"
                            >
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="dg-relation-destination">
                          <EndpointLink endpoint={row.destination} />
                        </td>
                        <td className="dg-relation-date">
                          {row.createdAt === null ? (
                            <span className={Classes.TEXT_MUTED}>
                              Unknown date
                            </span>
                          ) : (
                            <time
                              dateTime={new Date(row.createdAt).toISOString()}
                              title={new Date(row.createdAt).toLocaleString()}
                            >
                              {new Date(row.createdAt).toLocaleDateString(
                                "en-US",
                                {
                                  year: "numeric",
                                  month: "long",
                                  day: "numeric",
                                },
                              )}
                            </time>
                          )}
                        </td>
                        <td className="dg-relation-inspect">
                          <Button
                            minimal
                            small
                            icon="code"
                            aria-label={
                              expanded.has(row.uid)
                                ? "Hide relation properties"
                                : "Inspect relation properties"
                            }
                            title={
                              expanded.has(row.uid)
                                ? "Hide properties"
                                : "Inspect properties"
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
                        <tr className="dg-relation-details">
                          <td colSpan={5}>
                            <div className="dg-relation-props">
                              <strong>Properties</strong>
                              <span className={Classes.TEXT_MUTED}>
                                {" "}
                                · Read only · {row.uid}
                              </span>
                              <pre>{JSON.stringify(row.props, null, 2)}</pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </HTMLTable>
          </div>
          <div className="dg-relations-footer">
            <span className={Classes.TEXT_MUTED} aria-live="polite">
              {visible.length
                ? `${start + 1}–${Math.min(start + pageSize, visible.length)} of ${visible.length}`
                : rows.length
                  ? "0 results"
                  : "0"}
              {visible.length !== rows.length
                ? ` · ${rows.length} total`
                : " relations"}
            </span>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2">
                Results per page
                <InputGroup
                  small
                  className="w-16"
                  type="number"
                  min={1}
                  max={MAX_PAGE_SIZE}
                  step={1}
                  aria-label="Results per page"
                  value={pageSizeInput}
                  onChange={(event) => {
                    const input = event.target.value;
                    setPageSizeInput(input);
                    const value = Number(input);
                    if (Number.isSafeInteger(value) && value > 0) {
                      setPageSize(Math.min(value, MAX_PAGE_SIZE));
                      resetPage();
                    }
                  }}
                  onBlur={() => setPageSizeInput(String(pageSize))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                  }}
                />
              </label>
              <Button
                minimal
                small
                icon="chevron-left"
                aria-label="Previous relations"
                disabled={currentPage === 0}
                onClick={() => {
                  setPage(currentPage - 1);
                  viewport.current?.scrollTo({ top: 0 });
                }}
              />
              <Button
                minimal
                small
                icon="chevron-right"
                aria-label="Next relations"
                disabled={currentPage === lastPage}
                onClick={() => {
                  setPage(currentPage + 1);
                  viewport.current?.scrollTo({ top: 0 });
                }}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
};

export default RelationsPage;
