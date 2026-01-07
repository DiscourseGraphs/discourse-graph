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
import { USE_REIFIED_RELATIONS } from "~/data/userSettings";
import { getSetting } from "~/utils/extensionSettings";
import { strictQueryForReifiedBlocks } from "~/utils/createReifiedBlock";
import internalError from "~/utils/internalError";

const EXTRA_ROW_TYPES = ["context", "discourse"] as const;
type ExtraRowType = (typeof EXTRA_ROW_TYPES)[number] | null;

const ExtraContextRow = ({ uid }: { uid: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (getPageTitleByPageUid(uid)) {
      window.roamAlphaAPI.ui.components
        .renderPage({
          uid,
          el: containerRef.current,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "hide-mentions?": true,
        })
        .catch((error) => {
          internalError({
            error,
            type: "Results Table: Extra Context Row",
            context: { uid },
          });
        });
    } else {
      window.roamAlphaAPI.ui.components
        .renderBlock({
          uid,
          el: containerRef.current,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "zoom-path?": true,
        })
        .catch((error) => {
          internalError({
            error,
            type: "Results Table: Extra Context Row",
            context: { uid },
          });
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
      viewValue === "open" ? true : viewValue === "closed" ? false : undefined;
    if (el) {
      window.roamAlphaAPI.ui.components
        .renderBlock({
          uid,
          el,
          // eslint-disable-next-line @typescript-eslint/naming-convention
          "open?": open,
        })
        .catch((error) => {
          internalError({
            error,
            type: "Results Table: Cell Embed",
            context: { uid },
          });
        });
    }
  }, [contentRef, uid, viewValue]);
  return (
    <div ref={contentRef} className={title ? "page-embed" : "block-embed"} />
  );
};

export const CellLink = ({
  content,
  uid,
}: {
  content: string;
  uid: string;
}) => {
  const contentRef = useRef<HTMLSpanElement>(null);
  const isPage = !!getPageTitleByPageUid(uid);
  const displayString = isPage ? `[[${content}]]` : content;

  useEffect(() => {
    const el = contentRef.current;
    if (el && displayString) {
      window.roamAlphaAPI.ui.components.renderString({
        el,
        string: displayString,
      });
    }
  }, [displayString]);

  return <span ref={contentRef} className="roamjs-query-link-cell" />;
};

type ResultRowProps = {
  r: Result;
  columns: Column[];
  onDragStart: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrag: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
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
  onDragStart,
  onDrag,
  onDragEnd,
  onRefresh,
}: ResultRowProps) => {
  const useReifiedRel = getSetting<boolean>(USE_REIFIED_RELATIONS, false);
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
          onClick={() => {
            document.dispatchEvent(
              new CustomEvent("roamjs:query-builder:action", {
                detail: {
                  action,
                  uid: actionUid,
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
            onRefresh();
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
                [`data-cell-content`]: typeof val === "string" ? val : `${val}`,
                [`data-column-title`]: key,
              }}
            >
              {val === "" ? (
                <i>[block is blank]</i>
              ) : view === "link" ? (
                <CellLink content={val.toString()} uid={uid} />
              ) : view === "alias" ? (
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
                  {viewValue}
                </a>
              ) : view === "embed" ? (
                <CellEmbed uid={uid} viewValue={viewValue} />
              ) : (
                cell(key)
              )}
              {useReifiedRel &&
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
                  }}
                  data-left-column-uid={columnUid}
                  data-right-column-uid={columns[i + 1].uid}
                  data-column={columnUid}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", "");
                    e.dataTransfer.setDragImage(dragImage, 0, 0);
                    onDragStart(e);
                  }}
                  onDrag={onDrag}
                  onDragEnd={onDragEnd}
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
  startX: number;
  leftColumnUid: string | null;
  rightColumnUid: string | null;
  leftStartWidth: number;
  rightStartWidth: number;
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
  const dragInfo = useRef<DragInfo>({
    startX: 0,
    leftColumnUid: null,
    rightColumnUid: null,
    leftStartWidth: 0,
    rightStartWidth: 0,
  });

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

  const rafIdRef = useRef<number | null>(null);
  const throttledSetColumnWidths = useCallback((update: ColumnWidths) => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }
    rafIdRef.current = requestAnimationFrame(() =>
      setColumnWidths(
        (prev) =>
          ({
            ...prev,
            ...update,
          }) as ColumnWidths,
      ),
    );
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
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

  const onDragStart = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    const { leftColumnUid, rightColumnUid } = e.currentTarget.dataset;
    if (!leftColumnUid || !rightColumnUid || !tableRef.current) return;

    const leftHeader = tableRef.current?.querySelector(
      `thead td[data-column="${leftColumnUid}"]`,
    );
    const rightHeader = tableRef.current?.querySelector(
      `thead td[data-column="${rightColumnUid}"]`,
    );

    if (!leftHeader || !rightHeader) return;

    dragInfo.current = {
      startX: e.clientX,
      leftColumnUid,
      rightColumnUid,
      leftStartWidth: (leftHeader as HTMLElement).offsetWidth,
      rightStartWidth: (rightHeader as HTMLElement).offsetWidth,
    };
  }, []);

  const onDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (e.clientX === 0) return;

    const {
      startX,
      leftColumnUid,
      rightColumnUid,
      leftStartWidth,
      rightStartWidth,
    } = dragInfo.current;

    if (!leftColumnUid || !rightColumnUid) return;

    const delta = e.clientX - startX;
    const minWidth = 40;

    let newLeftWidth = leftStartWidth + delta;
    let newRightWidth = rightStartWidth - delta;

    const leftBelow = newLeftWidth < minWidth;
    const rightBelow = newRightWidth < minWidth;

    if (leftBelow && !rightBelow) {
      const adjustment = minWidth - newLeftWidth;
      newLeftWidth = minWidth;
      newRightWidth -= adjustment;
    } else if (rightBelow && !leftBelow) {
      const adjustment = minWidth - newRightWidth;
      newRightWidth = minWidth;
      newLeftWidth -= adjustment;
    } else if (leftBelow && rightBelow) {
      const totalMin = minWidth * 2;
      const startTotal = leftStartWidth + rightStartWidth;

      if (startTotal > totalMin) {
        const scale = totalMin / startTotal;
        newLeftWidth = Math.max(minWidth, leftStartWidth * scale);
        newRightWidth = Math.max(minWidth, rightStartWidth * scale);
      } else {
        newLeftWidth = leftStartWidth;
        newRightWidth = rightStartWidth;
      }
    }

    throttledSetColumnWidths({
      [leftColumnUid]: `${newLeftWidth}px`,
      [rightColumnUid]: `${newRightWidth}px`,
    });
  }, []);

  const onDragEnd = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    const totalWidth = tableRef.current?.offsetWidth;
    if (!totalWidth || totalWidth === 0) {
      return;
    }
    const minWidth = 40;
    const minPercent = (minWidth / totalWidth) * 100;

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

    const layoutUid = getSubTree({ parentUid, key: "layout" }).uid;
    if (layoutUid) {
      setInputSettings({
        blockUid: layoutUid,
        key: "widths",
        values: Object.entries(finalWidths).map(([k, v]) => `${k} - ${v}`),
      });
    }
  }, [parentUid, columnWidths, visibleColumns]);

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
              onDragStart={onDragStart}
              onDrag={onDrag}
              onDragEnd={onDragEnd}
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
