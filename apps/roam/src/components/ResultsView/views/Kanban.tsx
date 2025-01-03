// Design inspiration from Trello
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Column, Result } from "~/utils/types";
import { Button, Icon, InputGroup, Popover } from "@blueprintjs/core";
import Draggable, { DraggableData, DraggableEvent } from "react-draggable";
import setInputSettings from "roamjs-components/util/setInputSettings";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import setInputSetting from "roamjs-components/util/setInputSetting";
import { z } from "zod";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import predefinedSelections from "~/utils/predefinedSelections";
import toCellValue from "~/utils/toCellValue";
import extractTag from "roamjs-components/util/extractTag";
import deleteBlock from "roamjs-components/writes/deleteBlock";
import getSubTree from "roamjs-components/util/getSubTree";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { Sorts } from "~/utils/parseResultSettings";
import getRoamUrl from "roamjs-components/dom/getRoamUrl";

const zPriority = z.record(z.number().min(0).max(1));

type Reprioritize = (args: { uid: string; x: number; y: number }) => void;

const BlockEmbed = ({ uid, viewValue }: { uid: string; viewValue: string }) => {
  const title = getPageTitleByPageUid(uid);
  const contentRef = useRef(null);
  const open =
    viewValue === "open" ? true : viewValue === "closed" ? false : null;
  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      window.roamAlphaAPI.ui.components.renderBlock({
        uid,
        el,
        // "open?": open, // waiting for roamAlphaAPI to add a open/close to renderBlock
      });
    }
  }, [uid, open, contentRef]);
  return (
    <div ref={contentRef} className={!!title ? "page-embed" : "block-embed"} />
  );
};

type ViewsByColumnType = Record<
  string,
  { column: string; mode: string; value: string }
>;
const KanbanCard = (card: {
  $priority: number;
  $reprioritize: Reprioritize;
  $displayKey: string;
  $getColumnElement: (x: number) => HTMLDivElement | undefined;
  result: Result;
  $columnKey: string;
  $selectionValues: string[];
  viewsByColumn: ViewsByColumnType;
  activeSort: Sorts;
  handleDragStop: () => void;
  handleDragStart: (e: DraggableEvent, data: DraggableData) => void;
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const isDragHandle = useMemo(
    () =>
      Object.values(card.viewsByColumn).some(
        (v) => v.mode === "embed" || v.mode === "link",
      ),
    [card.viewsByColumn],
  );
  const displayKey = card.$displayKey;
  const cardView = card.viewsByColumn[displayKey];
  const displayUid = card.result[`${displayKey}-uid`];

  return (
    <Draggable
      handle={isDragHandle ? ".embed-handle" : ""}
      onDrag={(_, data) => {
        const { x, width } = data.node.getBoundingClientRect();
        const el = card.$getColumnElement(x + width / 2);
        if (el) el.style.background = "rgb(226, 232, 240)";
        setIsDragging(true);
      }}
      onStart={(e, data) => {
        card.handleDragStart(e, data);
        const target = data.node as HTMLElement;
        target.style.opacity = "0";
      }}
      onStop={(_, data) => {
        const { x, y, width, height } = data.node.getBoundingClientRect();
        card.$reprioritize({
          uid: card.result.uid,
          x: x + width / 2,
          y: y + height / 2,
        });
        // set timeout to prevent click handler
        setTimeout(() => setIsDragging(false));
        card.handleDragStop();
        // TODO
        // when card is moved to new column, it shows up in the old column for a split second
        // only noticable if all cards are in view
        const target = data.node as HTMLElement;
        target.style.opacity = "1";
      }}
      position={{ x: 0, y: 0 }}
    >
      <div
        className="roamjs-kanban-card"
        data-uid={card.result.uid}
        data-priority={card.$priority}
        onClick={(e) => {
          if (isDragHandle) return;
          if (isDragging) return;
          if (e.shiftKey) {
            openBlockInSidebar(displayUid);
            e.preventDefault();
            e.stopPropagation();
          } else {
            window.roamAlphaAPI.ui.mainWindow.openBlock({
              block: { uid: displayUid },
            });
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <Icon
          icon="drag-handle-horizontal"
          className="embed-handle absolute right-2 top-2 z-30 cursor-move text-gray-400"
          hidden={!isDragHandle}
        />
        <div
          className={`mb-3 rounded-xl bg-white p-4 ${
            isDragHandle ? "" : "cursor-pointer hover:bg-gray-200"
          }`}
        >
          <div className="card-display-value">
            {!displayUid ? (
              <div className="p-2">[block is blank]</div>
            ) : cardView.mode === "embed" ? (
              <div className="roamjs-query-embed -ml-4">
                <BlockEmbed uid={displayUid} viewValue={cardView.value} />
              </div>
            ) : cardView.mode === "link" ? (
              <div className="p-2">
                <a
                  href={getRoamUrl(displayUid)}
                  onClick={(e) => {
                    if (e.shiftKey) {
                      openBlockInSidebar(displayUid);
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }}
                >
                  {toCellValue({
                    value: card.result[displayKey],
                    uid: displayUid,
                  })}
                </a>
              </div>
            ) : (
              <div className="p-2">
                {toCellValue({
                  value: card.result[displayKey],
                  uid: displayUid,
                })}
              </div>
            )}
          </div>
          <div className="card-selections mt-3">
            <div
              className="grid grid-cols-2"
              style={{ gridTemplateColumns: "auto 1fr" }}
            >
              {card.$selectionValues.map((sv) => {
                if (sv === displayKey || sv === card.$columnKey) return null;

                const uid = card.result[`${sv}-uid`] || "";
                const value = toCellValue({
                  value: card.result[`${sv}-display`] || card.result[sv] || "",
                  uid,
                });

                return (
                  <React.Fragment key={sv}>
                    {!uid && card.viewsByColumn[sv].mode === "embed" ? (
                      <div className="col-span-2 p-2 text-sm">
                        [block is blank]
                      </div>
                    ) : card.viewsByColumn[sv].mode === "embed" ? (
                      <div className="col-span-2 -ml-4 text-sm">
                        <BlockEmbed
                          uid={uid}
                          viewValue={card.viewsByColumn[sv].value}
                        />
                      </div>
                    ) : uid && card.viewsByColumn[sv].mode === "link" ? (
                      <>
                        <div className="p-2 text-sm font-semibold">{sv}:</div>
                        <div className="p-2 text-left text-sm">
                          <a
                            className={"rm-page-ref"}
                            data-link-title={getPageTitleByPageUid(uid) || ""}
                            href={getRoamUrl(uid)}
                            onClick={(e) => {
                              if (e.shiftKey) {
                                openBlockInSidebar(uid);
                                e.preventDefault();
                                e.stopPropagation();
                              }
                            }}
                          >
                            {value}
                          </a>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="p-2 text-sm font-semibold">{sv}:</div>
                        <div className="p-2 text-left text-sm">{value}</div>
                      </>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Draggable>
  );
};

const inlineTry = <T extends unknown>(f: () => T, d: T) => {
  try {
    return f();
  } catch (e) {
    return d;
  }
};

const Kanban = ({
  data,
  layout,
  onQuery,
  resultKeys,
  parentUid,
  views,
  activeSort,
  setActiveSort,
  setPage,
  pageSize,
  showInterface,
  pageSizeTimeoutRef,
  setPageSize,
  page,
}: {
  resultKeys: Column[];
  data: Result[];
  layout: Record<string, string | string[]>;
  onQuery: () => void;
  parentUid: string;
  views: { column: string; mode: string; value: string }[];
  activeSort: Sorts;
  setActiveSort: (s: Sorts) => void;
  setPage: (p: number) => void;
  pageSize: number;
  showInterface: boolean;
  pageSizeTimeoutRef: React.MutableRefObject<number>;
  setPageSize: (p: number) => void;
  page: number;
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 });

  const handleDragStart = (event: DraggableEvent, data: DraggableData) => {
    const e = event as MouseEvent;
    setIsDragging(true);
    window.addEventListener("mousemove", handleMouseMove);
    if (parentRef.current) {
      const rect = parentRef.current.getBoundingClientRect();
      const offsetX = rect.left + window.scrollX;
      const offsetY = rect.top + window.scrollY;
      setCursorPosition({ x: e.clientX - offsetX, y: e.clientY - offsetY });
    }
  };

  const handleMouseMove = (event: MouseEvent) => {
    let offsetX = 0;
    let offsetY = 0;

    if (parentRef.current) {
      const rect = parentRef.current.getBoundingClientRect();
      offsetX = rect.left + window.scrollX;
      offsetY = rect.top + window.scrollY;
    }

    setCursorPosition({
      x: event.clientX - offsetX,
      y: event.clientY - offsetY,
    });
  };

  const handleDragStop = () => {
    setIsDragging(false);
    window.removeEventListener("mousemove", handleMouseMove);
  };
  const byUid = useMemo(
    () => Object.fromEntries(data.map((d) => [d.uid, d] as const)),
    [data],
  );
  const columnKey = useMemo(() => {
    const configuredKey = Array.isArray(layout.key)
      ? layout.key[0]
      : typeof layout.key === "string"
        ? layout.key
        : "";
    if (configuredKey) return configuredKey;
    const keySets = Object.fromEntries(
      resultKeys.map((rk) => [rk.key, new Set()]),
    );
    data.forEach((d) => {
      resultKeys.forEach((rk) => {
        keySets[rk.key].add(d[rk.key]);
      });
    });
    const defaultColumnKey = Object.entries(keySets).reduce(
      (prev, [k, v]) => (v.size < prev[1] ? ([k, v.size] as const) : prev),
      ["" as string, data.length + 1] as const,
    )[0];
    setInputSetting({
      key: "key",
      value: defaultColumnKey,
      blockUid: layout.uid as string,
    });
    return defaultColumnKey;
  }, [layout.key]);
  const DEFAULT_FORMAT = `No ${columnKey}`;
  const displayKey = useMemo(() => {
    const configuredDisplay = Array.isArray(layout.display)
      ? layout.display[0]
      : typeof layout.display === "string"
        ? layout.display
        : undefined;
    if (configuredDisplay) return configuredDisplay;
    const defaultDisplayKey = resultKeys[0].key;
    setInputSetting({
      key: "display",
      value: defaultDisplayKey,
      blockUid: layout.uid as string,
    });
    return defaultDisplayKey;
  }, [layout.display]);
  const [columns, setColumns] = useState<string[]>([]);

  useEffect(() => {
    const configuredCols = Array.isArray(layout.columns)
      ? layout.columns
      : typeof layout.columns === "string"
        ? [layout.columns]
        : undefined;
    if (configuredCols) return setColumns(configuredCols);

    const valueCounts = data.reduce(
      (prev, d) => {
        const key =
          d[`${columnKey}-display`]?.toString() ||
          d[columnKey]?.toString() ||
          DEFAULT_FORMAT;
        if (!prev[key]) {
          prev[key] = 0;
        }
        prev[key] += 1;
        return prev;
      },
      {} as Record<string, number>,
    );
    const cleanedValueCounts = Object.fromEntries(
      Object.entries(valueCounts).map(([key, value]) => [
        extractTag(key),
        value,
      ]),
    );
    const columns = Object.entries(cleanedValueCounts)
      .sort((a, b) => b[1] - a[1])
      .map((c) => c[0])
      .slice(0, 25);

    setColumns(columns);
  }, [columnKey]);

  const [prioritization, setPrioritization] = useState(() => {
    const base64 = Array.isArray(layout.prioritization)
      ? layout.prioritization[0]
      : typeof layout.prioritization === "string"
        ? layout.prioritization
        : "e30="; // base64 of {}
    const stored = inlineTry(
      () => zPriority.parse(JSON.parse(window.atob(base64))),
      {},
    );
    data.forEach((d) => {
      if (!stored[d.uid]) {
        stored[d.uid] = Math.random();
      }
    });
    return stored;
  });
  const layoutUid = useMemo(() => {
    return Array.isArray(layout.uid)
      ? layout.uid[0]
      : typeof layout.uid === "string"
        ? layout.uid
        : ""; // should we throw an error here? Should never happen in practice...
  }, [layout.uid]);
  const [isAdding, setIsAdding] = useState(false);
  const [newColumn, setNewColumn] = useState("");
  const cards = useMemo(() => {
    const cards: Record<string, Result[]> = {};
    data.forEach((d) => {
      const column =
        toCellValue({
          value: d[columnKey],
          defaultValue: DEFAULT_FORMAT,
          uid: d[`${columnKey}-uid`]?.toString(),
        }) || DEFAULT_FORMAT;
      if (!cards[column]) {
        cards[column] = [];
      }
      cards[column].push(d);
    });
    if (activeSort.length) return cards;
    Object.keys(cards).forEach((k) => {
      cards[k] = cards[k].sort(
        (a, b) => prioritization[a.uid] - prioritization[b.uid],
      );
    });
    return cards;
  }, [data, prioritization, columnKey]);
  const potentialColumns = useMemo(() => {
    const columnSet = new Set(columns);
    return Object.keys(cards).filter((c) => !columnSet.has(c));
  }, [cards, columns]);
  useEffect(() => {
    const base64 = window.btoa(JSON.stringify(prioritization));
    setInputSetting({
      blockUid: layoutUid,
      key: "prioritization",
      value: base64,
    });
  }, [prioritization]);
  const containerRef = useRef<HTMLDivElement>(null);
  const getColumnElement = useCallback(
    (x: number) => {
      if (!containerRef.current) return;
      const columnEls = Array.from<HTMLDivElement>(
        containerRef.current.querySelectorAll(".roamjs-kanban-column"),
      ).reverse();
      columnEls.forEach((el) => (el.style.background = ""));
      return columnEls.find((el) => {
        const { left } = el.getBoundingClientRect();
        return x >= left;
      });
    },
    [containerRef],
  );
  const reprioritizeAndUpdateBlock = useCallback<Reprioritize>(
    ({ uid, x, y }) => {
      if (!containerRef.current) return;
      const targetColumnEl = getColumnElement(x);
      const column = targetColumnEl?.getAttribute("data-column");
      if (!column || !targetColumnEl) return;

      const result = byUid[uid];
      const { [`${columnKey}-uid`]: columnUid } = result;
      if (!result) return;
      const previousValue = toCellValue({
        value: result[columnKey],
        uid: columnUid?.toString(),
      });
      const draggedToSameColumn = column === previousValue;

      // Get card priority
      const _cardIndex = Array.from(
        targetColumnEl.querySelectorAll(
          ".roamjs-kanban-card:not(.react-draggable-dragging)",
        ),
      )
        .map((el, index) => ({ el, index }))
        .reverse()
        .find(({ el }) => {
          const { top } = el.getBoundingClientRect();
          return y >= top;
        })?.index;
      const cardIndex = typeof _cardIndex === "undefined" ? -1 : _cardIndex;
      const topCard = cards[column]?.[cardIndex];
      const bottomCard = cards[column]?.[cardIndex + 1];
      const topPriority = prioritization[topCard?.uid] || 0;
      const bottomPriority = prioritization[bottomCard?.uid] || 1;
      const priority = (topPriority + bottomPriority) / 2;

      // Update prioritization
      if (activeSort.length && draggedToSameColumn) {
        const sortedUids = Object.values(cards)
          .flat()
          .map((card) => card.uid);
        const newPrioritization = sortedUids.reduce(
          (prioritization, uid, index) => {
            prioritization[uid] = index;
            return prioritization;
          },
          {} as Record<string, number>,
        );
        newPrioritization[uid] = priority;
        setPrioritization(newPrioritization);
        setActiveSort([]);
      } else {
        setPrioritization((p) => ({ ...p, [uid]: priority }));
      }

      // Update block
      if (!draggedToSameColumn) {
        const columnKeySelection = resultKeys.find(
          (rk) => rk.key === columnKey,
        )?.selection;
        if (!columnKeySelection) return;
        const predefinedSelection = predefinedSelections.find((ps) =>
          ps.test.test(columnKeySelection),
        );
        if (!predefinedSelection?.update) return;

        const isRemoveValue = column === DEFAULT_FORMAT;
        if (isRemoveValue && !previousValue) return;
        if (typeof columnUid !== "string") return;
        predefinedSelection
          .update({
            uid: columnUid,
            value: isRemoveValue ? "" : column,
            selection: columnKeySelection,
            parentUid,
            result,
            previousValue,
          })
          .then(onQuery);
      }
    },
    [setPrioritization, cards, containerRef, byUid, columnKey, parentUid],
  );
  const showLegend = useMemo(
    () => (Array.isArray(layout.legend) ? layout.legend[0] : layout.legend),
    [layout.legend],
  );
  const [openedPopoverIndex, setOpenedPopoverIndex] = useState<number | null>(
    null,
  );

  const moveColumn = async (
    direction: "left" | "right",
    columnIndex: number,
  ) => {
    const offset = direction === "left" ? -1 : 1;
    const newColumns = [...columns];
    // Swap elements
    [newColumns[columnIndex], newColumns[columnIndex + offset]] = [
      newColumns[columnIndex + offset],
      newColumns[columnIndex],
    ];

    const columnUid = getSubTree({
      key: "columns",
      parentUid: layoutUid,
    }).uid;
    await deleteBlock(columnUid);

    setInputSettings({
      blockUid: layoutUid,
      key: "columns",
      values: newColumns,
    });
    setColumns(newColumns);
    setOpenedPopoverIndex(null);
  };

  const viewsByColumn = useMemo(
    () => Object.fromEntries(views.map((v) => [v.column, v])),
    [views],
  );

  const PSEUDO_CARD_WIDTH = 250;
  return (
    <div className="relative" ref={parentRef}>
      <div
        aria-label="pseudo-dragging-card"
        className={`absolute z-30 cursor-move ${
          isDragging ? "block" : "hidden"
        }`}
        style={{
          left: cursorPosition.x - PSEUDO_CARD_WIDTH + 20,
          top: cursorPosition.y - 20,
          width: PSEUDO_CARD_WIDTH,
        }}
      >
        <div className="mb-3 cursor-move rounded-xl bg-white p-4 shadow-lg">
          <div className="font-semibold text-gray-800">Card</div>
        </div>
      </div>
      {showLegend === "Yes" && (
        <div
          className="w-full p-4"
          style={{
            background: "#eeeeee80",
          }}
        >
          <div className="mr-4 inline-block">
            <span className="font-bold">Group By:</span>
            <span> {columnKey}</span>
          </div>
          <div className="inline-block">
            <span className="font-bold">Display:</span>
            <span> {displayKey}</span>
          </div>
        </div>
      )}
      <div className="flex w-full p-4">
        <div
          className="roamjs-kanban-container relative flex w-full items-start gap-2 overflow-x-scroll"
          style={{ minHeight: "500px" }}
          ref={containerRef}
        >
          {columns.map((col, columnIndex) => {
            const totalCardsInColumn = (cards[col] || []).length;
            const cardsShown = page * pageSize;
            return (
              <div
                key={col}
                className="flex-shrink-1 roamjs-kanban-column flex max-w-2xl flex-col gap-2 rounded-2xl bg-gray-100 p-4"
                data-column={col}
                style={{ minWidth: "24rem" }}
              >
                <div
                  className="mb-4 items-center justify-between"
                  style={{ display: "flex" }}
                >
                  <span className="font-bold">{col}</span>
                  <Popover
                    autoFocus={false}
                    interactionKind="hover"
                    placement="bottom"
                    isOpen={openedPopoverIndex === columnIndex}
                    onInteraction={(next) =>
                      next
                        ? setOpenedPopoverIndex(columnIndex)
                        : setOpenedPopoverIndex(null)
                    }
                    captureDismiss={true}
                    content={
                      <>
                        <Button
                          className="p-4"
                          minimal
                          icon="arrow-left"
                          disabled={columnIndex === 0}
                          onClick={() => moveColumn("left", columnIndex)}
                          title="Move column left" // <Tooltip> was giving some weird interactions with the Popover
                        />
                        <Button
                          className="p-4"
                          minimal
                          icon="arrow-right"
                          disabled={columnIndex === columns.length - 1}
                          onClick={() => moveColumn("right", columnIndex)}
                          title="Move column right"
                        />
                        <Button
                          className="p-4"
                          intent="danger"
                          minimal
                          icon="trash"
                          onClick={() => {
                            const values = columns.filter((c) => c !== col);
                            setInputSettings({
                              blockUid: layout.uid as string,
                              key: "columns",
                              values,
                            });
                            setColumns(values);
                            setOpenedPopoverIndex(null);
                          }}
                          title="Delete column"
                        />
                      </>
                    }
                    position="bottom-left"
                  >
                    <Button icon="more" minimal />
                  </Popover>
                </div>
                <div
                  className="relative overflow-y-scroll overscroll-y-contain"
                  style={{ maxHeight: "70vh", overflowX: "clip" }}
                >
                  {(cards[col] || [])?.map((d, i) => {
                    if (i + 1 > cardsShown) return null;
                    return (
                      <>
                        <KanbanCard
                          key={d.uid}
                          result={d}
                          viewsByColumn={viewsByColumn}
                          activeSort={activeSort}
                          handleDragStart={handleDragStart}
                          handleDragStop={handleDragStop}
                          // we use $ to prefix these props to avoid collisions with the result object
                          $priority={prioritization[d.uid]}
                          $reprioritize={reprioritizeAndUpdateBlock}
                          $getColumnElement={getColumnElement}
                          $displayKey={displayKey}
                          $columnKey={columnKey}
                          $selectionValues={resultKeys.map((rk) => rk.key)}
                        />
                      </>
                    );
                  })}
                  <Button
                    text="Show More"
                    minimal
                    fill={true}
                    onClick={() => setPage(page + 1)}
                    disabled={totalCardsInColumn <= cardsShown}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div
        className={`p-0 ${!showInterface ? "hidden" : ""}`}
        style={{ background: "#eeeeee80" }}
      >
        <div
          className="flex items-center gap-4"
          style={{ padding: 4, paddingLeft: 8 }}
        >
          <span>Cards per column</span>
          <InputGroup
            defaultValue={pageSize.toString()}
            onChange={(e) => {
              clearTimeout(pageSizeTimeoutRef.current);
              pageSizeTimeoutRef.current = window.setTimeout(() => {
                setPageSize(Number(e.target.value));
                const resultUid = getSubTree({
                  key: "results",
                  parentUid,
                }).uid;
                setInputSetting({
                  key: "size",
                  value: e.target.value,
                  blockUid: resultUid,
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
          <div className="ml-auto p-2">
            {isAdding ? (
              <>
                <AutocompleteInput
                  placeholder="Enter column title..."
                  value={newColumn}
                  setValue={setNewColumn}
                  options={potentialColumns}
                />
                <div
                  className="mt-2 items-center justify-between"
                  style={{ display: "flex" }}
                >
                  <Button
                    intent="primary"
                    text="Add column"
                    className="text-xs"
                    disabled={!newColumn}
                    onClick={() => {
                      const values = [...columns, newColumn];
                      setInputSettings({
                        blockUid: layoutUid,
                        key: "columns",
                        values,
                      });
                      setColumns(values);
                      setIsAdding(false);
                      setNewColumn("");
                    }}
                  />
                  <Button
                    icon={"cross"}
                    minimal
                    onClick={() => setIsAdding(false)}
                  />
                </div>
              </>
            ) : (
              <Button
                minimal
                text="Add column"
                className="ml-auto cursor-pointer p-2"
                rightIcon={"plus"}
                onClick={() => setIsAdding(true)}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kanban;
