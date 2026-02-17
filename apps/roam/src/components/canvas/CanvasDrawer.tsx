import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Collapse,
  Icon,
  Menu,
  MenuItem,
  NonIdealState,
  Popover,
  Position,
  Tab,
  TabId,
  Tabs,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { Editor, useEditor, TLShapeId } from "tldraw";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import { DiscourseNodeShape } from "./DiscourseNodeUtil";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import posthog from "posthog-js";

export type GroupedShapes = Record<string, DiscourseNodeShape[]>;

type NodeGroup = {
  uid: string;
  title: string;
  type: string;
  typeLabel: string;
  shapes: DiscourseNodeShape[];
  isDuplicate: boolean;
};

type Props = {
  groupedShapes: GroupedShapes;
  pageUid: string;
  editor: Editor;
};

export const CanvasDrawerContent = ({
  groupedShapes,
  pageUid,
  editor,
}: Props) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("All");
  const [activeTab, setActiveTab] = useState<TabId>("all");

  const pageTitle = useMemo(() => getPageTitleByPageUid(pageUid), [pageUid]);
  const discourseNodes = useMemo(() => getDiscourseNodes(), []);

  const groups = useMemo(() => {
    const entries: NodeGroup[] = Object.entries(groupedShapes).map(
      ([uid, shapes]) => {
        const primaryShape = shapes[0];
        const typeLabel =
          discourseNodes.find((n) => n.type === primaryShape.type)?.text ||
          primaryShape.type ||
          "Unknown";
        return {
          uid,
          title: primaryShape.props.title,
          type: primaryShape.type,
          typeLabel,
          shapes,
          isDuplicate: shapes.length > 1,
        };
      },
    );

    return entries.sort((a, b) => {
      if (a.isDuplicate !== b.isDuplicate) {
        return a.isDuplicate ? -1 : 1;
      }
      return a.title.localeCompare(b.title);
    });
  }, [groupedShapes, discourseNodes]);

  useEffect(() => {
    setOpenSections((prev) => {
      const next: Record<string, boolean> = {};
      groups.forEach((group) => {
        next[group.uid] = prev[group.uid] ?? group.isDuplicate;
      });

      const isSame =
        Object.keys(prev).length === Object.keys(next).length &&
        Object.entries(next).every(([key, value]) => prev[key] === value);

      return isSame ? prev : next;
    });
  }, [groups]);

  const shapeTypes = useMemo(() => {
    const typeSet = new Set<string>();
    groups.forEach((group) => typeSet.add(group.typeLabel));
    return ["All", ...Array.from(typeSet).sort((a, b) => a.localeCompare(b))];
  }, [groups]);

  const duplicateGroups = useMemo(
    () => groups.filter((group) => group.isDuplicate),
    [groups],
  );
  const duplicateNodeCount = useMemo(
    () => duplicateGroups.reduce((sum, group) => sum + group.shapes.length, 0),
    [duplicateGroups],
  );
  const totalNodeCount = useMemo(
    () => groups.reduce((sum, group) => sum + group.shapes.length, 0),
    [groups],
  );

  const activeTabId = activeTab as "all" | "duplicates";

  const visibleGroups = useMemo(
    () =>
      groups.filter((group) => {
        const matchesType =
          filterType === "All" || group.typeLabel === filterType;
        const matchesTab = activeTabId === "all" ? true : group.isDuplicate;
        return matchesType && matchesTab;
      }),
    [groups, filterType, activeTabId],
  );

  const visibleNodeCount = useMemo(
    () => visibleGroups.reduce((sum, group) => sum + group.shapes.length, 0),
    [visibleGroups],
  );

  const isFiltered = filterType !== "All" || activeTabId === "duplicates";

  const handleTabChange = useCallback((tabId: TabId) => {
    setActiveTab(tabId);
  }, []);

  const toggleCollapse = useCallback((uid: string) => {
    setOpenSections((prevState) => ({
      ...prevState,
      [uid]: !prevState[uid],
    }));
  }, []);

  const moveCameraToShape = useCallback(
    (shapeId: string) => {
      const shape = editor.getShape(shapeId as TLShapeId);
      if (!shape) {
        return;
      }
      const x = shape.x || 0;
      const y = shape.y || 0;
      editor.centerOnPoint({ x, y }, { animation: { duration: 200 } });
      editor.select(shapeId as TLShapeId);
    },
    [editor],
  );

  const handleShapeSelection = useCallback(
    (shape: DiscourseNodeShape) => {
      setActiveShapeId(shape.id);
      moveCameraToShape(shape.id);
    },
    [moveCameraToShape],
  );

  const handleResetFilters = useCallback(() => {
    setFilterType("All");
    setActiveTab("all");
  }, []);

  const renderNodeTypeItem = useCallback(
    (typeLabel: string) => {
      const isAll = typeLabel === "All";
      const node = discourseNodes.find((n) => n.text === typeLabel);
      const nodeColor = formatHexColor(node?.canvasSettings?.color || "");
      return (
        <>
          {!isAll && (
            <div className="flex items-center">
              <div
                className="mr-2 h-3 w-3 select-none rounded-full"
                style={{ backgroundColor: nodeColor }}
              />
              <span>{typeLabel}</span>
            </div>
          )}
          {isAll && <span>{typeLabel}</span>}
        </>
      );
    },
    [discourseNodes],
  );

  const renderListView = useCallback(
    (group: NodeGroup) => {
      // const colors = getNodeColors(group.type);
      return (
        <div
          key={group.uid}
          className="border-b border-gray-300 py-2 last:border-b-0"
        >
          <Tooltip
            targetClassName="w-full"
            hoverOpenDelay={750}
            content={
              group.isDuplicate
                ? "Toggle to inspect duplicate instances"
                : "Jump to this node on the canvas"
            }
          >
            <div
              className="-mx-2 -my-1 flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50"
              onClick={() =>
                group.isDuplicate
                  ? toggleCollapse(group.uid)
                  : handleShapeSelection(group.shapes[0])
              }
            >
              <div className="flex items-center gap-2">
                <div
                  className={`flex items-center gap-1 ${group.isDuplicate ? "flex-initial" : ""}`}
                >
                  {group.isDuplicate ? (
                    <Button
                      minimal
                      small
                      icon={
                        openSections[group.uid]
                          ? "chevron-down"
                          : "chevron-right"
                      }
                      className="pointer-events-none"
                    />
                  ) : (
                    <Button
                      minimal
                      small
                      icon="dot"
                      className="pointer-events-none"
                    />
                  )}
                  <span>{group.title}</span>
                </div>
                {group.isDuplicate && <Tag minimal>{group.shapes.length}</Tag>}
              </div>
              {!group.isDuplicate && (
                <Button
                  minimal
                  small
                  icon="locate"
                  className="pointer-events-none"
                />
              )}
            </div>
          </Tooltip>
          {group.isDuplicate && (
            <Collapse isOpen={openSections[group.uid]}>
              <div className="ml-5 mt-1 flex flex-col gap-1">
                {group.shapes.map((shape, index) => (
                  <Tooltip
                    targetClassName="w-full"
                    key={shape.id}
                    content="Jump to this node on canvas"
                    hoverOpenDelay={750}
                  >
                    <div
                      className={`-mx-2 -my-1 flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-gray-50 ${
                        activeShapeId === shape.id ? "bg-blue-50" : ""
                      }`}
                      onClick={() => handleShapeSelection(shape)}
                    >
                      <div className="flex items-center gap-1">
                        <Button
                          minimal
                          small
                          icon="dot"
                          className="pointer-events-none"
                        />
                        <span>Instance {index + 1}</span>
                      </div>
                      <Button
                        minimal
                        small
                        icon="locate"
                        className="pointer-events-none"
                      />
                    </div>
                  </Tooltip>
                ))}
              </div>
            </Collapse>
          )}
        </div>
      );
    },
    [
      // getNodeColors,
      openSections,
      toggleCollapse,
      handleShapeSelection,
      activeShapeId,
    ],
  );

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex-shrink-0 space-y-3">
        <Tabs
          id="canvas-drawer-tabs"
          selectedTabId={activeTabId}
          onChange={handleTabChange}
          renderActiveTabPanelOnly
        >
          <Tab id="all" title={`All Nodes (${totalNodeCount})`} />
          <Tab id="duplicates" title={`Duplicates (${duplicateNodeCount})`} />
        </Tabs>
        <div className="flex flex-wrap items-center gap-2">
          <Popover
            content={
              <Menu>
                {shapeTypes.map((type) => (
                  <MenuItem
                    key={type}
                    text={renderNodeTypeItem(type)}
                    onClick={() => setFilterType(type)}
                    active={filterType === type}
                  />
                ))}
              </Menu>
            }
            position={Position.BOTTOM_LEFT}
          >
            <Button
              text={renderNodeTypeItem(filterType)}
              rightIcon="caret-down"
              alignText="left"
            />
          </Popover>
          <Tooltip content="Reset filters">
            <span>
              <Button
                icon="filter-remove"
                minimal
                disabled={!isFiltered}
                onClick={handleResetFilters}
              />
            </span>
          </Tooltip>
          {isFiltered && (
            <Tag minimal icon="eye-open">
              {visibleNodeCount} visible
            </Tag>
          )}
        </div>
      </div>

      {!visibleGroups.length ? (
        <NonIdealState
          icon={isFiltered ? "filter" : "search"}
          title={
            isFiltered
              ? "No nodes match your filters"
              : `No nodes found for ${pageTitle}`
          }
          description={
            isFiltered
              ? "Try a different node type or switch tabs."
              : "Add discourse nodes to this canvas to populate the drawer."
          }
          action={
            isFiltered ? (
              <Button minimal icon="filter-remove" onClick={handleResetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="min-h-0 flex-1 divide-y divide-gray-300 overflow-y-auto overflow-x-hidden">
          {visibleGroups.map((group) => renderListView(group))}
        </div>
      )}
    </div>
  );
};

export const CanvasDrawerPanel = () => {
  const editor = useEditor();
  const toggleDrawer = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      posthog.capture("Canvas Drawer: Toggled", {
        isOpen: next,
      });
      return next;
    });
  }, []);
  const [isOpen, setIsOpen] = useState(false);
  const pageUid = getCurrentPageUid();
  const [groupedShapes, setGroupedShapes] = useState<GroupedShapes>({});

  useEffect(() => {
    const updateGroupedShapes = () => {
      const allRecords = editor.store.allRecords();
      const shapes = allRecords.filter((record) => {
        if (record.typeName !== "shape") return false;
        const shape = record as DiscourseNodeShape;
        return !!shape.props?.uid;
      }) as DiscourseNodeShape[];

      const grouped = shapes.reduce((acc: GroupedShapes, shape) => {
        const uid = shape.props.uid;
        if (!acc[uid]) acc[uid] = [];
        acc[uid].push(shape);
        return acc;
      }, {});

      setGroupedShapes(grouped);
    };

    updateGroupedShapes();

    const unsubscribe = editor.store.listen(() => {
      updateGroupedShapes();
    });

    return () => {
      unsubscribe();
    };
  }, [editor.store]);

  return (
    <>
      <div
        className={`pointer-events-auto absolute top-11 m-2 rounded-lg ${isOpen ? "hidden" : ""}`}
        style={{
          zIndex: 250,
          // copying tldraw var(--shadow-2)
          boxShadow:
            "0px 0px 2px hsl(0, 0%, 0%, 16%), 0px 2px 3px hsl(0, 0%, 0%, 24%), 0px 2px 6px hsl(0, 0%, 0%, 0.1), inset 0px 0px 0px 1px hsl(0, 0%, 100%)",
          backgroundColor: "white",
        }}
      >
        <Button
          icon={<Icon icon="add-column-left" />}
          onClick={toggleDrawer}
          minimal
          title="Toggle Canvas Drawer"
        />
      </div>
      {isOpen && (
        <div
          className="pointer-events-auto absolute bottom-10 left-2 flex w-80 flex-col rounded-lg bg-white"
          style={{
            top: "3.25rem",
            height: "calc(100% - 50px)",
            zIndex: 250,
            boxShadow:
              "0px 0px 2px hsl(0, 0%, 0%, 16%), 0px 2px 3px hsl(0, 0%, 0%, 24%), 0px 2px 6px hsl(0, 0%, 0%, 0.1), inset 0px 0px 0px 1px hsl(0, 0%, 100%)",
          }}
        >
          <div
            className="flex max-h-10 flex-shrink-0 items-center rounded-lg bg-white px-1"
            style={{ minHeight: "35px" }}
          >
            <div className="flex-shrink-0">
              <Button
                icon={<Icon icon="add-column-left" />}
                onClick={() => setIsOpen(false)}
                minimal
              />
            </div>
            <h2 className="m-0 flex-1 pb-1 text-center text-sm font-semibold leading-tight">
              Canvas Drawer
            </h2>
            <div className="flex-shrink-0">
              <Button
                icon={<Icon icon="cross" />}
                onClick={() => setIsOpen(false)}
                minimal
                small
                className="h-6 min-h-0 p-1"
              />
            </div>
          </div>
          <div
            className="flex min-h-0 flex-1 flex-col overflow-hidden p-4"
            style={{ borderTop: "1px solid hsl(0, 0%, 91%)" }}
          >
            <CanvasDrawerContent
              groupedShapes={groupedShapes}
              pageUid={pageUid}
              editor={editor}
            />
          </div>
        </div>
      )}
    </>
  );
};
