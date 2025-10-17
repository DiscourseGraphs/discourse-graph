import React, { useEffect, useMemo, useRef, useState } from "react";
import ResizableDrawer from "~/components/ResizableDrawer";
import renderOverlay from "roamjs-components/util/renderOverlay";
import { Button, Collapse, Checkbox } from "@blueprintjs/core";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import MenuItemSelect from "roamjs-components/components/MenuItemSelect";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getBlockProps from "~/utils/getBlockProps";
import { TLBaseShape } from "tldraw";
import { DiscourseNodeShape } from "./DiscourseNodeUtil";
import { render as renderToast } from "roamjs-components/components/Toast";

export type GroupedShapes = Record<string, DiscourseNodeShape[]>;

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
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [filterType, setFilterType] = useState("All");
  const [filteredShapes, setFilteredShapes] = useState<GroupedShapes>({});

  const pageTitle = useMemo(() => getPageTitleByPageUid(pageUid), [pageUid]);
  const noResults = Object.keys(groupedShapes).length === 0;
  const typeToTitleMap = useMemo(() => {
    const nodes = getDiscourseNodes();
    const map: { [key: string]: string } = {};
    nodes.forEach((node) => {
      map[node.type] = node.text;
    });
    return map;
  }, []);
  const shapeTypes = useMemo(() => {
    const allTypes = new Set(["All"]);
    Object.values(groupedShapes).forEach((shapes) =>
      shapes.forEach((shape) =>
        allTypes.add(typeToTitleMap[shape.type] || shape.type),
      ),
    );
    return Array.from(allTypes);
  }, [groupedShapes, typeToTitleMap]);
  const hasDuplicates = useMemo(() => {
    return Object.values(groupedShapes).some((shapes) => shapes.length > 1);
  }, [groupedShapes]);

  useEffect(() => {
    const filtered = Object.entries(groupedShapes).reduce<GroupedShapes>(
      (acc, [uid, shapes]) => {
        const filteredShapes = shapes.filter(
          (shape) =>
            filterType === "All" || typeToTitleMap[shape.type] === filterType,
        );
        if (
          filteredShapes.length > 0 &&
          (!showDuplicates || filteredShapes.length > 1)
        ) {
          acc[uid] = filteredShapes;
        }
        return acc;
      },
      {},
    );
    setFilteredShapes(filtered);
  }, [groupedShapes, showDuplicates, filterType, typeToTitleMap]);

  const toggleCollapse = (uid: string) => {
    setOpenSections((prevState) => ({ ...prevState, [uid]: !prevState[uid] }));
  };
  const moveCameraToShape = (shapeId: string) => {
    document.dispatchEvent(
      new CustomEvent("roamjs:query-builder:action", {
        detail: { action: "move-camera-to-shape", shapeId },
      }),
    );
  };

  return (
    <div>
      <div className="my-4 flex items-baseline justify-around">
        <MenuItemSelect
          onItemSelect={(type) => setFilterType(type)}
          activeItem={filterType}
          items={shapeTypes}
        />
        {hasDuplicates && (
          <Checkbox
            label="Duplicates"
            checked={showDuplicates}
            onChange={() => setShowDuplicates(!showDuplicates)}
          />
        )}
      </div>
      {noResults ? (
        <div>No nodes found for {pageTitle}</div>
      ) : (
        Object.entries(filteredShapes).map(([uid, shapes]) => {
          const title = shapes[0].props.title;
          const isExpandable = shapes.length > 1;
          return (
            <div key={uid} className="mb-2">
              <Button
                onClick={() => {
                  if (isExpandable) toggleCollapse(uid);
                  else moveCameraToShape(shapes[0].id);
                }}
                icon={
                  isExpandable
                    ? openSections[uid]
                      ? "chevron-down"
                      : "chevron-right"
                    : "dot"
                }
                alignText="left"
                fill
                minimal
              >
                {title}
              </Button>
              <Collapse isOpen={openSections[uid]}>
                <div className="pt-2" style={{ background: "#eeeeee80" }}>
                  {shapes.map((shape) => (
                    <Button
                      key={shape.id}
                      icon={"dot"}
                      onClick={() => moveCameraToShape(shape.id)}
                      alignText="left"
                      fill
                      minimal
                      className="ml-4"
                    >
                      {shape.props.title}
                    </Button>
                  ))}
                </div>
              </Collapse>
            </div>
          );
        })
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

  // Toggle behavior: if already open, close it
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
      Overlay: CanvasDrawer,
      props: { groupedShapes, pageUid, unmountRef: drawerUnmountRef },
    }) || null;
};

export default CanvasDrawer;
