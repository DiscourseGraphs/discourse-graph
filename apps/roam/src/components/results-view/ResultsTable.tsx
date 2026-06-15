import React, {
  useMemo,
  useRef,
  useEffect,
  useState,
  useCallback,
} from "react";
import { Button, HTMLTable, Icon, IconName } from "@blueprintjs/core";
import { IconNames } from "@blueprintjs/icons";
import { render as renderToast } from "roamjs-components/components/Toast";
import { Column, Result } from "~/utils/types";
import type { FilterData, Sorts, Views } from "~/utils/parseResultSettings";
import Filter, { Filters } from "roamjs-components/components/Filter";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getSubTree from "roamjs-components/util/getSubTree";
import createBlock from "roamjs-components/writes/createBlock";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import setInputSettings from "roamjs-components/util/setInputSettings";
import toCellValue from "~/utils/toCellValue";
import { ContextContent } from "~/components/DiscourseContext";
import DiscourseContextOverlay from "~/components/DiscourseContextOverlay";
import { CONTEXT_OVERLAY_SUGGESTION } from "~/utils/predefinedSelections";
import { strictQueryForReifiedBlocks } from "~/utils/createReifiedBlock";
import { getStoredRelationsEnabled } from "~/utils/storedRelations";
import {
  RenderRoamBlock,
  RenderRoamPage,
  RenderRoamBlockString,
} from "~/utils/roamReactComponents";

const EXTRA_ROW_TYPES = ["context", "discourse"] as const;
type ExtraRowType = (typeof EXTRA_ROW_TYPES)[number] | null;

const ExtraContextRow = ({ uid }: { uid: string }) => {
  return getPageTitleByPageUid(uid) ? (
    <RenderRoamPage uid={uid} hideMentions />
  ) : (
    <RenderRoamBlock uid={uid} zoomPath />
  );
};

const COLUMN_RESIZING_CLASS = "roamjs-query-column-resizing";
const MIN_COLUMN_WIDTH = 40;

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
  ({
    c,
    allResults,
    activeSort,
    setActiveSort,
    filters,
    setFilters,
    initialFilter,
    columnWidth,
  }) => {
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
    return (
      <td
        style={{
          cursor: "pointer",
          textTransform: "capitalize",
          width: columnWidth,
        }}
        data-column={c.uid}
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

ResultHeader.displayName = "ResultHeader";

export const CellEmbed = ({
  uid,
  viewValue,
}: {
  uid: string;
  viewValue?: string;
}) => {
  const title = getPageTitleByPageUid(uid);
  const open =
    viewValue === "open" ? true : viewValue === "closed" ? false : undefined;
  return (
    <div className={title ? "page-embed" : "block-embed"}>
      <RenderRoamBlock uid={uid} open={open} />
    </div>
  );
};

const CellRender = ({ content, uid }: { content: string; uid: string }) => {
  const isPage = !!getPageTitleByPageUid(uid);
  const displayString = isPage ? `[[${content}]]` : content;

  return (
    <span className="roamjs-query-link-cell">
      <RenderRoamBlockString string={displayString} />
    </span>
  );
};

type ResultRowProps = {
  r: Result;
  columns: Column[];
  onResizeStart: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResize: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeEnd: (e: React.PointerEvent<HTMLDivElement>) => void;
  onResizeLostPointerCapture: (e: React.PointerEvent<HTMLDivElement>) => void;
  parentUid: string;
  ctrlClick?: (e: Result) => void;
  views: { column: string; mode: string; value: string }[];
  onRefresh: (ignoreCache?: boolean) => void;
};

const ResultRow = ({
  r,
  columns,
  parentUid,
  ctrlClick,
  views,
  onResizeStart,
  onResize,
  onResizeEnd,
  onResizeLostPointerCapture,
  onRefresh,
}: ResultRowProps) => {
  const storedRelationsEnabled = getStoredRelationsEnabled();
  const cell = (key: string) => {
    const value = toCellValue({
      value: r[`${key}-display`] || r[key] || "",
      uid: r[`${key}-uid`] || "",
    });
    const action = r[`${key}-action`];
    if (typeof action === "string") {
      const buttonProps =
        value.toUpperCase().replace(/\s/g, "_") in IconNames
          ? { icon: value as IconName, minimal: true }
          : { text: value };
      const actionUid = r[`${key}-uid`];

      if (
        action === "discourse" &&
        value === CONTEXT_OVERLAY_SUGGESTION &&
        actionUid
      ) {
        return (
          <DiscourseContextOverlay
            uid={actionUid}
            id={`discourse-overlay-${parentUid}-${actionUid}`}
          />
        );
      }
      return (
        <Button
          {...buttonProps}
          onClick={(event) => {
            const targetCanvasPageUid =
              event.currentTarget.closest<HTMLElement>(
                ".roamjs-tldraw-canvas-container[data-page-uid]",
              )?.dataset.pageUid || undefined;
            document.dispatchEvent(
              new CustomEvent("roamjs:query-builder:action", {
                detail: {
                  action,
                  uid: actionUid,
                  val: r["text"],
                  onRefresh,
                  queryUid: parentUid,
                  targetCanvasPageUid,
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
  const onDelete = () => {
    const data = {
      sourceUid: r["complement"] === 1 ? r["uid"] : r["ctxTargetUid"],
      destinationUid: r["complement"] === 1 ? r["ctxTargetUid"] : r["uid"],
      hasSchema: r["id"],
    } as Record<string, string>;
    // types got checked as a condition for displaying the button
    strictQueryForReifiedBlocks(data)
      .then((blockUid) => {
        if (blockUid === null) {
          renderToast({
            id: "delete-relation-error",
            content: "Could not find relation",
            intent: "warning",
          });
          return;
        }
        deleteBlock(blockUid)
          .then(() => {
            renderToast({
              id: "delete-relation-success",
              content: "Relation deleted",
              intent: "success",
            });
            onRefresh(true);
          })
          .catch((e) => {
            // this one should be an internalError
            console.error(e);
            renderToast({
              id: "delete-relation-error",
              content: "Could not delete relation",
              intent: "danger",
            });
          });
      })
      .catch((e) => {
        // this one should be an internalError
        console.error(e);
        renderToast({
          id: "delete-relation-error",
          content: "Error searching for relation",
          intent: "danger",
        });
      });
  };

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
                [`data-cell-content`]:
                  typeof val === "string" ? val : String(val),
                [`data-column-title`]: key,
              }}
            >
              {val === "" ? (
                <i>[block is blank]</i>
              ) : view === "render" ? (
                <CellRender content={val.toString()} uid={uid} />
              ) : view === "link" || view === "alias" ? (
                <a
                  className={"rm-page-ref"}
                  data-link-title={getPageTitleByPageUid(uid) || ""}
                  href={(r[`${key}-url`] as string) || getRoamUrl(uid)}
                  onMouseDown={(e) => {
                    if (e.shiftKey) {
                      void openBlockInSidebar(uid);
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
              {storedRelationsEnabled &&
                typeof r["ctxTargetUid"] === "string" &&
                typeof r["id"] === "string" &&
                typeof r["complement"] === "number" &&
                i === columns.length - 1 && (
                  <Button
                    minimal
                    icon="delete"
                    className="float-right"
                    title="Delete relation"
                    onClick={onDelete}
                  ></Button>
                )}
              {i < columns.length - 1 && (
                <div
                  style={{
                    width: 2,
                    cursor: "ew-resize",
                    position: "absolute",
                    top: 0,
                    right: 0,
                    bottom: 0,
                    background: `rgba(16,22,26,0.15)`,
                    touchAction: "none",
                  }}
                  data-left-column-uid={columnUid}
                  data-right-column-uid={columns[i + 1].uid}
                  data-column={columnUid}
                  onPointerDown={onResizeStart}
                  onPointerMove={onResize}
                  onPointerUp={onResizeEnd}
                  onPointerCancel={onResizeEnd}
                  onLostPointerCapture={onResizeLostPointerCapture}
                />
              )}
            </td>
          );
        })}
      </tr>
    </>
  );
};

type ColumnWidths = {
  [key: string]: string;
};

type DragInfo = {
  pointerId: number | null;
  startX: number;
  moved: boolean;
  leftHeader: HTMLElement | null;
  rightHeader: HTMLElement | null;
  leftStartWidth: number;
  rightStartWidth: number;
};

const getInitialDragInfo = (): DragInfo => ({
  pointerId: null,
  startX: 0,
  moved: false,
  leftHeader: null,
  rightHeader: null,
  leftStartWidth: 0,
  rightStartWidth: 0,
});

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
  onRefresh: (ignoreCache?: boolean) => void;
  allResults: Result[];
  showInterface?: boolean;
}) => {
  const tableRef = useRef<HTMLTableElement | null>(null);
  const dragInfo = useRef<DragInfo>(getInitialDragInfo());

  const viewsByColumn = useMemo(
    () => Object.fromEntries(views.map((v) => [v.column, v])),
    [views],
  );

  const visibleColumns = useMemo(() => {
    const filtered = columns.filter(
      (column) => viewsByColumn[column.key]?.mode !== "hidden",
    );
    return filtered.length ? filtered : columns;
  }, [columns, viewsByColumn]);

  useEffect(() => {
    return () => document.body.classList.remove(COLUMN_RESIZING_CLASS);
  }, []);

  const [columnWidths, setColumnWidths] = useState(() => {
    const widths =
      typeof layout.widths === "string" ? [layout.widths] : layout.widths || [];
    const fromLayout = Object.fromEntries(
      widths.map((w) => w.split(" - ")).filter((p) => p.length === 2),
    );
    const allWidths: ColumnWidths = {};
    const defaultWidth = `${100 / (visibleColumns.length || columns.length)}%`;
    columns.forEach((c) => {
      allWidths[c.uid] = fromLayout[c.uid] || defaultWidth;
    });
    return allWidths;
  });

  const onResizeStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (dragInfo.current.pointerId !== null) return;
    const { leftColumnUid, rightColumnUid } = e.currentTarget.dataset;
    if (!leftColumnUid || !rightColumnUid || !tableRef.current) return;

    const leftHeader = tableRef.current.querySelector<HTMLElement>(
      `thead td[data-column="${leftColumnUid}"]`,
    );
    const rightHeader = tableRef.current.querySelector<HTMLElement>(
      `thead td[data-column="${rightColumnUid}"]`,
    );

    if (!leftHeader || !rightHeader) return;

    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    document.body.classList.add(COLUMN_RESIZING_CLASS);

    dragInfo.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      moved: false,
      leftHeader,
      rightHeader,
      leftStartWidth: leftHeader.offsetWidth,
      rightStartWidth: rightHeader.offsetWidth,
    };
  }, []);

  const onResize = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragInfo.current.pointerId !== e.pointerId) return;
    e.preventDefault();
    e.stopPropagation();

    const { startX, leftHeader, rightHeader, leftStartWidth, rightStartWidth } =
      dragInfo.current;

    if (!leftHeader || !rightHeader) return;

    const delta = e.clientX - startX;
    if (delta !== 0) dragInfo.current.moved = true;

    let newLeftWidth = leftStartWidth + delta;
    let newRightWidth = rightStartWidth - delta;

    const leftBelow = newLeftWidth < MIN_COLUMN_WIDTH;
    const rightBelow = newRightWidth < MIN_COLUMN_WIDTH;

    if (leftBelow && !rightBelow) {
      const adjustment = MIN_COLUMN_WIDTH - newLeftWidth;
      newLeftWidth = MIN_COLUMN_WIDTH;
      newRightWidth -= adjustment;
    } else if (rightBelow && !leftBelow) {
      const adjustment = MIN_COLUMN_WIDTH - newRightWidth;
      newRightWidth = MIN_COLUMN_WIDTH;
      newLeftWidth -= adjustment;
    } else if (leftBelow && rightBelow) {
      const totalMin = MIN_COLUMN_WIDTH * 2;
      const startTotal = leftStartWidth + rightStartWidth;

      if (startTotal > totalMin) {
        const scale = totalMin / startTotal;
        newLeftWidth = Math.max(MIN_COLUMN_WIDTH, leftStartWidth * scale);
        newRightWidth = Math.max(MIN_COLUMN_WIDTH, rightStartWidth * scale);
      } else {
        newLeftWidth = leftStartWidth;
        newRightWidth = rightStartWidth;
      }
    }

    leftHeader.style.width = `${newLeftWidth}px`;
    rightHeader.style.width = `${newRightWidth}px`;
  }, []);

  const finishResize = useCallback(
    ({
      pointerId,
      resizeHandle,
    }: {
      pointerId: number;
      resizeHandle?: HTMLDivElement;
    }) => {
      const currentDrag = dragInfo.current;
      if (currentDrag.pointerId !== pointerId) return;

      dragInfo.current = getInitialDragInfo();

      if (resizeHandle?.hasPointerCapture(pointerId)) {
        resizeHandle.releasePointerCapture(pointerId);
      }

      document.body.classList.remove(COLUMN_RESIZING_CLASS);
      if (!currentDrag.moved) return;

      const totalWidth = tableRef.current?.offsetWidth;
      if (!totalWidth || totalWidth === 0) {
        return;
      }
      const minPercent = (MIN_COLUMN_WIDTH / totalWidth) * 100;

      const finalWidths: ColumnWidths = { ...columnWidths };
      const uids = visibleColumns.map((c) => c.uid);
      uids.forEach((uid) => {
        const header = tableRef.current?.querySelector(
          `thead td[data-column="${uid}"]`,
        );
        if (header) {
          const headerWidth = (header as HTMLElement).offsetWidth;
          if (headerWidth > 0) {
            const percent = (headerWidth / totalWidth) * 100;
            finalWidths[uid] = `${Math.max(minPercent, percent)}%`;
          } else {
            finalWidths[uid] = columnWidths[uid] || "5%";
          }
        }
      });
      setColumnWidths(finalWidths);

      if (preventSavingSettings) return;
      const layoutUid = getSubTree({ parentUid, key: "layout" }).uid;
      if (layoutUid) {
        setInputSettings({
          blockUid: layoutUid,
          key: "widths",
          values: Object.entries(finalWidths).map(([k, v]) => `${k} - ${v}`),
        });
      }
    },
    [parentUid, columnWidths, visibleColumns, preventSavingSettings],
  );
  const onResizeEnd = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      finishResize({ pointerId: e.pointerId, resizeHandle: e.currentTarget });
    },
    [finishResize],
  );
  const onResizeLostPointerCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishResize({ pointerId: e.pointerId });
    },
    [finishResize],
  );

  const resultHeaderSetFilters = React.useCallback(
    (fs: FilterData) => {
      setFilters(fs);

      if (preventSavingSettings) return;
      const filtersNode = getSubTree({
        key: "filters",
        parentUid,
      });
      filtersNode.children.forEach((c) => void deleteBlock(c.uid));
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
        .forEach(
          (node, order) =>
            void createBlock({
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
      elementRef={tableRef}
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
          {visibleColumns.map((c) => (
            <ResultHeader
              key={c.uid}
              c={c}
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
              columns={visibleColumns}
              onResizeStart={onResizeStart}
              onResize={onResize}
              onResizeEnd={onResizeEnd}
              onResizeLostPointerCapture={onResizeLostPointerCapture}
            />
            {extraRowUid === r.uid && (
              <tr className={`roamjs-${extraRowType}-row roamjs-extra-row`}>
                <td colSpan={visibleColumns.length}>
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
    </HTMLTable>
  );
};

export default ResultsTable;
