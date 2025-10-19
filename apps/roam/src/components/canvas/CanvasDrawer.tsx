import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ResizableDrawer from "~/components/ResizableDrawer";
import renderOverlay from "roamjs-components/util/renderOverlay";
import {
  Button,
  Card,
  Collapse,
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
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getBlockProps from "~/utils/getBlockProps";
import { colord } from "colord";
import getPleasingColors from "@repo/utils/getPleasingColors";
import { discourseContext } from "./Tldraw";
import { TLBaseShape } from "tldraw";
import { DiscourseNodeShape } from "./DiscourseNodeUtil";
import { render as renderToast } from "roamjs-components/components/Toast";

export type GroupedShapes = Record<string, DiscourseNodeShape[]>;

// Color constants from DiscourseNodeUtil
const COLOR_ARRAY = [
  "black",
  "blue",
  "green",
  "grey",
  "light-blue",
  "light-green",
  "light-red",
  "light-violet",
  "orange",
  "red",
  "violet",
  "white",
  "yellow",
];
const COLOR_PALETTE: Record<string, string> = {
  black: "#1d1d1d",
  blue: "#4263eb",
  green: "#099268",
  grey: "#adb5bd",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "light-blue": "#4dabf7",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "light-green": "#40c057",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "light-red": "#ff8787",
  // eslint-disable-next-line @typescript-eslint/naming-convention
  "light-violet": "#e599f7",
  orange: "#f76707",
  red: "#e03131",
  violet: "#ae3ec9",
  white: "#ffffff",
  yellow: "#ffc078",
};

type NodeGroup = {
  uid: string;
  title: string;
  type: string;
  typeLabel: string;
  shapes: DiscourseNodeShape[];
  isDuplicate: boolean;
};

// Module-level ref holder set by the provider
// This allows openCanvasDrawer to be called from non-React contexts
// (command palette, context menus, etc.)
let drawerUnmountRef: React.MutableRefObject<(() => void) | null> | null = null;

export const CanvasDrawerProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const unmountRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    drawerUnmountRef = unmountRef;

    return () => {
      if (unmountRef.current) {
        unmountRef.current();
        unmountRef.current = null;
      }
      drawerUnmountRef = null;
    };
  }, []);

  return <>{children}</>;
};

type Props = { groupedShapes: GroupedShapes; pageUid: string };

const CanvasDrawerContent = ({ groupedShapes, pageUid }: Props) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [activeShapeId, setActiveShapeId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState("All");
  const [activeTab, setActiveTab] = useState<TabId>("all");

  const pageTitle = useMemo(() => getPageTitleByPageUid(pageUid), [pageUid]);
  const discourseNodes = useMemo(() => getDiscourseNodes(), []);

  // Helper function to get the same colors as canvas nodes
  const getNodeColors = useCallback((nodeType: string) => {
    const {
      canvasSettings: { color: setColor = "" } = {},
      index: discourseNodeIndex = -1,
    } = discourseContext.nodes[nodeType] || {};
    const paletteColor =
      COLOR_ARRAY[
        discourseNodeIndex >= 0 && discourseNodeIndex < COLOR_ARRAY.length - 1
          ? discourseNodeIndex
          : 0
      ];
    const formattedTextColor =
      setColor && !setColor.startsWith("#") ? `#${setColor}` : setColor;

    const canvasSelectedColor = formattedTextColor
      ? formattedTextColor
      : COLOR_PALETTE[paletteColor];
    const pleasingColors = getPleasingColors(colord(canvasSelectedColor));
    return {
      backgroundColor: pleasingColors.background,
      textColor: pleasingColors.text,
    };
  }, []);

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

  const moveCameraToShape = useCallback((shapeId: string) => {
    document.dispatchEvent(
      new CustomEvent("roamjs:query-builder:action", {
        detail: { action: "move-camera-to-shape", shapeId },
      }),
    );
  }, []);

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
      const colors = node
        ? getNodeColors(node.type)
        : { backgroundColor: "#000", textColor: "#fff" };
      return (
        <div className="flex items-center">
          {!isAll && (
            <div
              className="mr-2 h-3 w-3 select-none rounded-full"
              style={{ backgroundColor: colors.backgroundColor }}
            />
          )}
          <span>{typeLabel}</span>
        </div>
      );
    },
    [discourseNodes, getNodeColors],
  );

  const renderShapeButton = useCallback(
    (shape: DiscourseNodeShape, group: NodeGroup, index: number) => (
      <Tooltip
        key={shape.id}
        content="Jump to this node on canvas"
        hoverOpenDelay={750}
      >
        <Button
          alignText="left"
          fill
          minimal
          outlined
          icon={group.isDuplicate ? "duplicate" : "dot"}
          rightIcon="locate"
          active={activeShapeId === shape.id}
          onClick={() => handleShapeSelection(shape)}
          className="my-1"
        >
          {group.isDuplicate ? `Instance ${index + 1}` : shape.props.title}
        </Button>
      </Tooltip>
    ),
    [activeShapeId, handleShapeSelection],
  );

  return (
    <div className="space-y-4">
      <Card elevation={1} className="space-y-3">
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
      </Card>

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
        <div className="space-y-3">
          {visibleGroups.map((group) => {
            const colors = getNodeColors(group.type);
            return (
              <Card
                key={group.uid}
                elevation={group.isDuplicate ? 2 : 1}
                className="space-y-2"
                style={{
                  backgroundColor: colors.backgroundColor,
                  color: colors.textColor,
                }}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Tooltip
                    hoverOpenDelay={750}
                    content={
                      group.isDuplicate
                        ? "Toggle to inspect duplicate instances"
                        : "Jump to this node on the canvas"
                    }
                  >
                    <Button
                      alignText="left"
                      fill
                      minimal
                      icon={
                        group.isDuplicate
                          ? openSections[group.uid]
                            ? "chevron-down"
                            : "chevron-right"
                          : undefined
                      }
                      rightIcon={group.isDuplicate ? undefined : "locate"}
                      onClick={() =>
                        group.isDuplicate
                          ? toggleCollapse(group.uid)
                          : handleShapeSelection(group.shapes[0])
                      }
                    >
                      {group.title}
                    </Button>
                  </Tooltip>
                </div>
                {group.isDuplicate && (
                  <Collapse isOpen={openSections[group.uid]}>
                    <div className="flex gap-1 rounded p-2">
                      {group.shapes.map((shape, index) =>
                        renderShapeButton(shape, group, index),
                      )}
                    </div>
                  </Collapse>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CanvasDrawer = ({
  onClose,
  unmountRef,
  ...props
}: {
  onClose: () => void;
  unmountRef: React.MutableRefObject<(() => void) | null>;
} & Props) => {
  const handleClose = () => {
    unmountRef.current = null;
    onClose();
  };

  return (
    <ResizableDrawer onClose={handleClose} title={"Canvas Drawer"}>
      <CanvasDrawerContent {...props} />
    </ResizableDrawer>
  );
};

export const openCanvasDrawer = (): void => {
  if (!drawerUnmountRef) {
    renderToast({
      id: "canvas-drawer-not-found",
      content:
        "Unable to open Canvas Drawer.  Please load canvas in main window first.",
      intent: "warning",
    });
    console.error(
      "CanvasDrawer: Cannot open drawer - CanvasDrawerProvider not found",
    );
    return;
  }

  if (drawerUnmountRef.current) {
    drawerUnmountRef.current();
    drawerUnmountRef.current = null;
    return;
  }

  const pageUid = getCurrentPageUid();
  const props = getBlockProps(pageUid) as Record<string, unknown>;
  const rjsqb = props["roamjs-query-builder"] as Record<string, unknown>;
  const tldraw = (rjsqb?.tldraw as Record<string, unknown>) || {};
  const store = (tldraw?.["store"] as Record<string, unknown>) || {};
  const shapes = Object.values(store).filter((s) => {
    const shape = s as TLBaseShape<string, { uid: string }>;
    const uid = shape.props?.uid;
    return !!uid;
  }) as DiscourseNodeShape[];

  const groupShapesByUid = (shapes: DiscourseNodeShape[]) => {
    const groupedShapes = shapes.reduce((acc: GroupedShapes, shape) => {
      const uid = shape.props.uid;
      if (!acc[uid]) acc[uid] = [];
      acc[uid].push(shape);
      return acc;
    }, {});

    return groupedShapes;
  };

  const groupedShapes = groupShapesByUid(shapes);
  drawerUnmountRef.current =
    renderOverlay({
      // eslint-disable-next-line @typescript-eslint/naming-convention
      Overlay: CanvasDrawer,
      props: { groupedShapes, pageUid, unmountRef: drawerUnmountRef },
    }) || null;
};

export default CanvasDrawer;
