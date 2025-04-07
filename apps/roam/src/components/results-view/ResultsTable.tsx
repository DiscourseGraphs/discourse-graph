import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import {
  Button,
  HTMLTable,
  Icon,
  IconName,
  InputGroup,
} from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { Column, Result } from "~/utils/types";
import type { FilterData, Sorts, Views } from "~/utils/parseResultSettings";
import Filter, { Filters } from "roamjs-components/components/Filter";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getSubTree from "roamjs-components/util/getSubTree";
import setInputSetting from "roamjs-components/util/setInputSetting";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import setInputSettings from "roamjs-components/util/setInputSettings";
import toCellValue from "~/utils/toCellValue";
import { ContextContent } from "~/components/DiscourseContext";

const EXTRA_ROW_TYPES = ["context", "discourse"] as const;
type ExtraRowType = (typeof EXTRA_ROW_TYPES)[number] | null;

const ExtraContextRow = ({ uid }: { uid: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (getPageTitleByPageUid(uid)) {
      window.roamAlphaAPI.ui.components.renderPage({
        uid,
        el: containerRef.current,
        hideMentions: true,
      });
    } else {
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el: containerRef.current,
        zoomPath: true,
      });
    }
  }, [containerRef, uid]);

  return <div ref={containerRef} />;
};

const dragImage = document.createElement("img");
dragImage.src =
  "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

const ResultHeader = React.forwardRef<
  Record<string, HTMLTableCellElement>,
  {
    c: Column;
    allResults: Result[];
    activeSort: Sorts;
    setActiveSort: (s: Sorts) => void;
    filters: FilterData;
    setFilters: (f: FilterData) => void;
    initialFilter: Filters;
    columnWidth?: string;
  }
>(
  (
    {
      c,
      allResults,
      activeSort,
      setActiveSort,
      filters,
      setFilters,
      initialFilter,
      columnWidth,
    },
    ref,
  ) => {
    const filterData = useMemo(
      () => ({
        values: Array.from(
          new Set(
            allResults.map((r) =>
              toCellValue({ value: r[c.key], uid: r[`${c.key}-uid`] }),
            ),
          ),
        ),
      }),
      [allResults, c],
    );
    const sortIndex = useMemo(
      () => activeSort.findIndex((s) => s.key === c.key),
      [c.key, activeSort],
    );
    const refCallback = useCallback(
      (r: HTMLTableDataCellElement) => {
        if (ref && "current" in ref && ref.current) ref.current[c.uid] = r;
      },
      [ref, c.uid],
    );
    return (
      <td
        style={{
          cursor: "pointer",
          textTransform: "capitalize",
          width: columnWidth,
        }}
        data-column={c.uid}
        ref={refCallback}
        key={c.uid}
        onClick={() => {
          if (sortIndex >= 0) {
            if (activeSort[sortIndex].descending) {
              setActiveSort(activeSort.filter((s) => s.key !== c.key));
            } else {
              setActiveSort(
                activeSort.map((s) =>
                  s.key === c.key ? { key: c.key, descending: true } : s,
                ),
              );
            }
          } else {
            setActiveSort([...activeSort, { key: c.key, descending: false }]);
          }
        }}
      >
        <div className="flex items-center">
          <span className="mr-4 inline-block">{c.key}</span>
          <span>
            <Filter
              data={filterData}
              initialValue={initialFilter}
              onChange={(newFilters) =>
                setFilters({ ...filters, [c.key]: newFilters })
              }
              renderButtonText={(s) =>
                s ? s.toString() : <i style={{ opacity: 0.5 }}>(Empty)</i>
              }
              small
            />
            {sortIndex >= 0 && (
              <span>
                <Icon
                  icon={
                    activeSort[sortIndex].descending ? "sort-desc" : "sort-asc"
                  }
                  size={12}
                />
                <span style={{ fontSize: 8 }}>({sortIndex + 1})</span>
              </span>
            )}
          </span>
        </div>
      </td>
    );
  },
);

export const CellEmbed = ({
  uid,
  viewValue,
}: {
  uid: string;
  viewValue?: string;
}) => {
  const title = getPageTitleByPageUid(uid);
  const contentRef = useRef(null);
  useEffect(() => {
    const el = contentRef.current;
    const open =
      viewValue === "open" ? true : viewValue === "closed" ? false : null;
    const zoomPath = viewValue === "On" ? true : false; // temp
    if (el) {
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el,
        // "open?": open, // waiting for roamAlphaAPI to add a open/close to renderBlock
        "zoom-path?": zoomPath, // TODO update roamjs-components
      });
    }
  }, [contentRef]);
  return (
    <div className="roamjs-query-embed">
      <div
        ref={contentRef}
        className={!!title ? "page-embed" : "block-embed"}
      />
    </div>
  );
};

type OnWidthUpdate = (args: {
  column: string;
  width: string;
  save?: boolean;
}) => void;
const ResultRow = ({
  r,
  parentUid,
  ctrlClick,
  views,
  onRefresh,
  columns,
  onWidthUpdate,
}: {
  r: Result;
  parentUid: string;
  ctrlClick?: (e: Result) => void;
  views: { column: string; mode: string; value: string }[];
  columns: Column[];
  onRefresh: () => void;
  onWidthUpdate: OnWidthUpdate;
}) => {
  const cell = (key: string) => {
    const value = toCellValue({
      value: r[`${key}-display`] || r[key] || "",
      uid: (r[`${key}-uid`] as string) || "",
    });
    const action = r[`${key}-action`];
    if (typeof action === "string") {
      const buttonProps =
        value.toUpperCase().replace(/\s/g, "_") in IconNames
          ? { icon: value as IconName, minimal: true }
          : { text: value };
      return (
        <Button
          {...buttonProps}
          onClick={() => {
            document.dispatchEvent(
              new CustomEvent("roamjs:query-builder:action", {
                detail: {
                  action,
                  uid: r[`${key}-uid`],
                  val: r["text"],
                  onRefresh,
                  queryUid: parentUid,
                },
              }),
            );
          }}
        />
      );
    }

    return value
      .toString()
      .split("<span>")
      .map((s, i) => (
        <span
          key={i}
          className={i % 2 === 0 ? "" : "roamjs-query-hightlighted-result"}
        >
          {s}
        </span>
      ));
  };
  const viewsByColumn = useMemo(
    () => Object.fromEntries(views.map((v) => [v.column, v])),
    [views],
  );
  const trRef = useRef<HTMLTableRowElement>(null);
  const dragHandler = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const delta = e.clientX - e.currentTarget.getBoundingClientRect().left;
      const cellWidth =
        e.currentTarget.parentElement?.getBoundingClientRect().width;
      if (typeof cellWidth === "undefined") return;
      if (cellWidth + delta <= 0) return;
      const rowWidth =
        e.currentTarget.parentElement?.parentElement?.getBoundingClientRect()
          .width;
      if (typeof rowWidth === "undefined") return;
      if (cellWidth + delta >= rowWidth) return;
      const column = e.currentTarget.getAttribute("data-column");
      const save = e.type === "dragend";
      if (trRef.current) {
        trRef.current.style.cursor = save ? "" : "ew-resize";
      }
      if (column)
        onWidthUpdate({
          column,
          width: `${((cellWidth + delta) / rowWidth) * 100}%`,
          save,
        });
    },
    [onWidthUpdate],
  );
  return (
    <>
      <tr ref={trRef} data-uid={r.uid}>
        {columns.map(({ key, uid: columnUid }, i) => {
          const uid = (r[`${key}-uid`] || "").toString();
          const val = r[key] || "";
          const { mode: view, value: viewValue } = viewsByColumn[key] || {};
          return (
            <td
              className={"relative overflow-hidden text-ellipsis"}
              key={key}
              {...{
                [`data-cell-content`]: typeof val === "string" ? val : `${val}`,
                [`data-column-title`]: key,
              }}
            >
              {val === "" ? (
                <i>[block is blank]</i>
              ) : view === "link" || view === "alias" ? (
                <a
                  className={"rm-page-ref"}
                  data-link-title={getPageTitleByPageUid(uid) || ""}
                  href={(r[`${key}-url`] as string) || getRoamUrl(uid)}
                  onMouseDown={(e) => {
                    if (e.shiftKey) {
                      openBlockInSidebar(uid);
                      e.preventDefault();
                      e.stopPropagation();
                    } else if (e.ctrlKey) {
                      ctrlClick?.({
                        text: toCellValue({ value: val, uid }),
                        uid,
                      });
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onClick={(e) => {
                    if (e.shiftKey || e.ctrlKey) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                  onContextMenu={(e) => {
                    if (e.ctrlKey) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  {view === "alias" ? viewValue : cell(key)}
                </a>
              ) : view === "embed" ? (
                <CellEmbed uid={uid} viewValue={viewValue} />
              ) : (
                cell(key)
              )}
              {i < columns.length - 1 && (
                <div
                  style={{
                    width: 1,
                    cursor: "ew-resize",
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    background: `rgba(16,22,26,0.15)`,
                  }}
                  data-column={columnUid}
                  draggable
                  onDragStart={(e) =>
                    e.dataTransfer.setDragImage(dragImage, 0, 0)
                  }
                  onDrag={dragHandler}
                  onDragEnd={dragHandler}
                />
              )}
            </td>
          );
        })}
      </tr>
    </>
  );
};

const ResultsTable = ({
  columns,
  results,
  parentUid,
  layout,
  activeSort,
  setActiveSort,
  filters,
  setFilters,
  preventSavingSettings,
  onRefresh,
  views,
  pageSize,
  setPageSize,
  pageSizeTimeoutRef,
  page,
  setPage,
  allProcessedResults,
  allResults,
  showInterface,
}: {
  columns: Column[];
  results: Result[];
  parentUid: string;
  layout: Record<string, string | string[]>;
  // TODO - can a lot of these settings become layout settings instead of global?
  activeSort: Sorts;
  setActiveSort: (s: Sorts) => void;
  filters: FilterData;
  setFilters: (f: FilterData) => void;
  preventSavingSettings?: boolean;
  views: Views;
  pageSize: number;
  setPageSize: (p: number) => void;
  pageSizeTimeoutRef: React.MutableRefObject<number>;
  page: number;
  setPage: (p: number) => void;
  onRefresh: () => void;
  allProcessedResults: Result[];
  allResults: Result[];
  showInterface?: boolean;
}) => {
  const columnWidths = useMemo(() => {
    const widths =
      typeof layout.widths === "string" ? [layout.widths] : layout.widths || [];
    return Object.fromEntries(
      widths
        .map((w) => {
          const match = /^(.*) - ([^-]+)$/.exec(w);
          return match;
        })
        .filter((m): m is RegExpExecArray => !!m)
        .map((match) => {
          return [match[1], match[2]];
        }),
    );
  }, [layout]);
  const thRefs = useRef<Record<string, HTMLTableCellElement>>({});
  const onWidthUpdate = useCallback<OnWidthUpdate>(
    (args) => {
      const cell = thRefs.current[args.column];
      if (!cell) return;
      cell.style.width = args.width;
      if (args.save) {
        const layoutUid = getSubTree({ parentUid, key: "layout" }).uid;
        if (layoutUid)
          setInputSettings({
            blockUid: layoutUid,
            key: "widths",
            values: Object.entries(thRefs.current)
              .map(([k, v]) => [k, v.style.width])
              .filter(([k, v]) => !!k && !!v)
              .map(([k, v]) => `${k} - ${v}`),
          });
      }
    },
    [thRefs, parentUid],
  );
  const resultHeaderSetFilters = React.useCallback(
    (fs: FilterData) => {
      setFilters(fs);

      if (preventSavingSettings) return;
      const filtersNode = getSubTree({
        key: "filters",
        parentUid,
      });
      filtersNode.children.forEach((c) => deleteBlock(c.uid));
      Object.entries(fs)
        .filter(
          ([, data]) => data.includes.values.size || data.excludes.values.size,
        )
        .map(([column, data]) => ({
          text: column,
          children: [
            {
              text: "includes",
              children: Array.from(data.includes.values).map((text) => ({
                text,
              })),
            },
            {
              text: "excludes",
              children: Array.from(data.excludes.values).map((text) => ({
                text,
              })),
            },
          ],
        }))
        .forEach((node, order) =>
          createBlock({
            parentUid: filtersNode.uid,
            node,
            order,
          }),
        );
    },
    [setFilters, preventSavingSettings, parentUid],
  );
  const tableProps = useMemo(
    () =>
      layout.rowStyle !== "Bare" ? { striped: true, interactive: true } : {},
    [layout.rowStyle],
  );

  const [extraRowUid, setExtraRowUid] = useState<string | null>(null);
  const [extraRowType, setExtraRowType] = useState<ExtraRowType>(null);
  useEffect(() => {
    const actionListener = ((e: CustomEvent) => {
      if (parentUid !== e.detail.queryUid) return;

      const row = document.querySelector(
        `table[data-parent-uid="${parentUid}"] tr[data-uid="${e.detail.uid}"]`,
      );
      if (!row || !row.parentElement) return;

      const actionRowType = EXTRA_ROW_TYPES.find((ert) =>
        new RegExp(ert, "i").test(e.detail.action),
      );
      if (!actionRowType) return;

      setExtraRowUid(e.detail.uid);
      setExtraRowType((oldRowType) => {
        if (oldRowType === actionRowType) {
          return null;
        } else {
          return actionRowType;
        }
      });
    }) as EventListener;
    document.addEventListener("roamjs:query-builder:action", actionListener);
    return () => {
      document.removeEventListener(
        "roamjs:query-builder:action",
        actionListener,
      );
    };
  }, [parentUid, setExtraRowType]);
  useEffect(() => {
    if (extraRowType === null) setExtraRowUid(null);
  }, [extraRowType, setExtraRowUid]);
  return (
    <HTMLTable
      style={{
        maxHeight: "400px",
        overflowY: "scroll",
        width: "100%",
        tableLayout: "fixed",
        borderRadius: 3,
      }}
      data-parent-uid={parentUid}
      {...tableProps}
    >
      <thead style={{ background: "#eeeeee80" }}>
        <tr style={{ visibility: !showInterface ? "collapse" : "visible" }}>
          {columns.map((c) => (
            <ResultHeader
              key={c.uid}
              c={c}
              ref={thRefs}
              allResults={allResults}
              activeSort={activeSort}
              setActiveSort={setActiveSort}
              filters={filters}
              setFilters={resultHeaderSetFilters}
              initialFilter={filters[c.key]}
              columnWidth={columnWidths[c.uid]}
            />
          ))}
        </tr>
      </thead>
      <tbody>
        {results.map((r) => (
          <React.Fragment key={Object.values(r).join("-")}>
            <ResultRow
              r={r}
              parentUid={parentUid}
              views={views}
              onRefresh={onRefresh}
              columns={columns}
              onWidthUpdate={onWidthUpdate}
            />
            {extraRowUid === r.uid && (
              <tr className={`roamjs-${extraRowType}-row roamjs-extra-row`}>
                <td colSpan={columns.length}>
                  {extraRowUid && extraRowType === "context" ? (
                    <ExtraContextRow uid={extraRowUid} />
                  ) : extraRowUid && extraRowType === "discourse" ? (
                    <ContextContent uid={extraRowUid} />
                  ) : null}
                </td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
      <tfoot style={!showInterface ? { display: "none" } : {}}>
        <tr>
          <td
            colSpan={columns.length}
            style={{ padding: 0, background: "#eeeeee80" }}
          >
            <div
              className="flex items-center justify-between"
              style={{ padding: 4 }}
            >
              <div
                className="flex items-center gap-4"
                style={{ paddingLeft: 4 }}
              >
                <span>Rows per page:</span>
                <InputGroup
                  defaultValue={pageSize.toString()}
                  onChange={(e) => {
                    clearTimeout(pageSizeTimeoutRef.current);
                    pageSizeTimeoutRef.current = window.setTimeout(() => {
                      setPageSize(Number(e.target.value));

                      if (preventSavingSettings) return;
                      setInputSetting({
                        key: "size",
                        value: e.target.value,
                        blockUid: parentUid,
                      });
                    }, 1000);
                  }}
                  type="number"
                  style={{
                    width: 60,
                    maxWidth: 60,
                    marginRight: 32,
                    marginLeft: 16,
                  }}
                />
              </div>
              <span>
                <Button
                  minimal
                  icon={"double-chevron-left"}
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                  small
                />
                <Button
                  minimal
                  icon={"chevron-left"}
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  small
                />
                <span style={{ margin: "4px 0" }} className={"text-sm"}>
                  {page}
                </span>
                <Button
                  minimal
                  icon={"chevron-right"}
                  onClick={() => setPage(page + 1)}
                  disabled={
                    page === Math.ceil(allProcessedResults.length / pageSize) ||
                    allProcessedResults.length === 0
                  }
                  small
                />
                <Button
                  minimal
                  icon={"double-chevron-right"}
                  disabled={
                    page === Math.ceil(allProcessedResults.length / pageSize) ||
                    allProcessedResults.length === 0
                  }
                  onClick={() =>
                    setPage(Math.ceil(allProcessedResults.length / pageSize))
                  }
                  small
                />
              </span>
            </div>
          </td>
        </tr>
      </tfoot>
    </HTMLTable>
  );
};

export default ResultsTable;
