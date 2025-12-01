import React, { useMemo, useRef } from "react";
import {
  useEditor,
  useValue,
  useQuickReactor,
  Vec,
  Box,
  createShapeId,
  FONT_FAMILIES,
} from "tldraw";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { getRelationColor } from "./DiscourseRelationShape/DiscourseRelationUtil";
import { useAtom } from "@tldraw/state";
import { TOOL_ARROW_ICON_SVG, NODE_COLOR_ICON_SVG } from "~/icons";
import { getDiscourseNodeColors } from "~/utils/getDiscourseNodeColors";
import { DEFAULT_WIDTH, DEFAULT_HEIGHT } from "./Tldraw";
import { DEFAULT_STYLE_PROPS, FONT_SIZES } from "./DiscourseNodeUtil";

export type DiscourseGraphPanelProps = {
  nodes: DiscourseNode[];
  relations: string[];
};

// https://github.com/tldraw/tldraw/blob/main/apps/examples/src/examples/drag-and-drop-tray/DragAndDropTrayExample.tsx

type DragState =
  | {
      name: "idle";
    }
  | {
      name: "pointing_item";
      item: {
        type: "node" | "relation";
        id: string;
        text: string;
        backgroundColor: string;
        textColor: string;
        color: string;
      };
      startPosition: Vec;
    }
  | {
      name: "dragging";
      item: {
        type: "node" | "relation";
        id: string;
        text: string;
        backgroundColor: string;
        textColor: string;
        color: string;
      };
      currentPosition: Vec;
    };

const TOOL_ARROW_ICON_DATA_URL = `data:image/svg+xml;base64,${btoa(TOOL_ARROW_ICON_SVG)}`;
const NODE_COLOR_ICON_DATA_URL = `data:image/svg+xml;base64,${btoa(NODE_COLOR_ICON_SVG)}`;

const DiscourseGraphPanel = ({
  nodes,
  relations,
}: DiscourseGraphPanelProps) => {
  const editor = useEditor();
  const rPanelContainer = useRef<HTMLDivElement>(null);
  const rDraggingImage = useRef<HTMLDivElement>(null);

  const currentToolId = useValue(
    "currentToolId",
    () => {
      return editor.getCurrentToolId();
    },
    [editor],
  );

  const uniqueRelations = useMemo(() => [...new Set(relations)], [relations]);

  const currentNodeTool = nodes.find((node) => node.type === currentToolId);
  const currentRelationTool = uniqueRelations.find(
    (relation) => relation === currentToolId,
  );

  const panelItems = useMemo(() => {
    const nodeItems = nodes.map((node) => {
      const { backgroundColor, textColor } = getDiscourseNodeColors({
        nodeType: node.type,
      });
      return {
        type: "node" as const,
        id: node.type,
        text: node.text,
        backgroundColor: backgroundColor,
        textColor: textColor,
        color: formatHexColor(node.canvasSettings.color) || "black",
        shortcut: node.shortcut,
      };
    });

    const relationItems = uniqueRelations.map((relation, index) => {
      const color = getRelationColor(relation, index);
      return {
        type: "relation" as const,
        id: relation,
        text: relation,
        backgroundColor: color,
        textColor: "black",
        color: color,
      };
    });

    return [...nodeItems, ...relationItems];
  }, [nodes, uniqueRelations]);

  // Drag state management
  const dragState = useAtom<DragState>("dragState", () => ({
    name: "idle",
  }));

  // Event handlers
  const { handlePointerUp, handlePointerDown } = useMemo(() => {
    let target: HTMLDivElement | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragState.get();
      const screenPoint = new Vec(e.clientX, e.clientY);

      switch (current.name) {
        case "idle": {
          break;
        }
        case "pointing_item": {
          // Relations should not be draggable
          if (current.item.type === "relation") {
            break;
          }
          const dist = Vec.Dist(screenPoint, current.startPosition);
          if (dist > 10) {
            dragState.set({
              name: "dragging",
              item: current.item,
              currentPosition: screenPoint,
            });
          }
          break;
        }
        case "dragging": {
          dragState.set({
            ...current,
            currentPosition: screenPoint,
          });
          break;
        }
      }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      const current = dragState.get();

      target = e.currentTarget as HTMLDivElement;
      target.releasePointerCapture(e.pointerId);

      switch (current.name) {
        case "idle": {
          break;
        }
        case "pointing_item": {
          // If it's just a click (not a drag), activate the tool
          const itemIndex = target.dataset.drag_item_index!;
          const item = panelItems[+itemIndex];
          if (item) {
            editor.setCurrentTool(item.id);
          }
          dragState.set({
            name: "idle",
          });
          break;
        }
        case "dragging": {
          // When dragging ends, create the shape at the drop position
          const pagePoint = editor.screenToPage(current.currentPosition);
          const zoomLevel = editor.getZoomLevel();
          const offsetX = DEFAULT_WIDTH / 2 / zoomLevel;
          const offsetY = DEFAULT_HEIGHT / 2 / zoomLevel;

          if (current.item.type === "node") {
            const shapeId = createShapeId();
            editor.createShape({
              id: shapeId,
              type: current.item.id,
              x: pagePoint.x - offsetX,
              y: pagePoint.y - offsetY,
              props: { fontFamily: "sans", size: "s" },
            });
            editor.setEditingShape(shapeId);
            editor.setCurrentTool("select");
          } else {
            // For relations, just activate the tool
            editor.setCurrentTool(current.item.id);
          }

          dragState.set({
            name: "idle",
          });
          break;
        }
      }

      removeEventListeners();
    };

    const handlePointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      target = e.currentTarget as HTMLDivElement;
      target.setPointerCapture(e.pointerId);

      const itemIndex = target.dataset.drag_item_index!;
      const item = panelItems[+itemIndex];

      if (!item) return;

      // Relations should not be draggable, only clickable
      if (item.type === "relation") {
        return;
      }

      const startPosition = new Vec(e.clientX, e.clientY);

      dragState.set({
        name: "pointing_item",
        item,
        startPosition,
      });

      target.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("keydown", handleKeyDown);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const current = dragState.get();
      if (e.key === "Escape" && current.name === "dragging") {
        removeEventListeners();
      }
    };

    const removeEventListeners = () => {
      if (target) {
        target.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("keydown", handleKeyDown);
      }

      dragState.set({
        name: "idle",
      });
    };

    return {
      handlePointerDown,
      handlePointerUp,
    };
  }, [dragState, editor, panelItems]);

  const state = useValue("dragState", () => dragState.get(), [dragState]);

  const zoomLevel = Math.max(
    0.5,
    useValue("clipboardZoomLevel", () => editor.getZoomLevel(), [editor]),
  );
  // Drag preview management
  useQuickReactor(
    "drag-image-style",
    () => {
      const current = dragState.get();
      const imageRef = rDraggingImage.current;
      const panelContainerRef = rPanelContainer.current;
      if (!imageRef || !panelContainerRef) return;

      switch (current.name) {
        case "idle":
        case "pointing_item": {
          imageRef.style.display = "none";
          break;
        }
        case "dragging": {
          // Relations should not be draggable
          if (current.item.type === "relation") {
            imageRef.style.display = "none";
            break;
          }
          const panelContainerRect = panelContainerRef.getBoundingClientRect();
          const box = new Box(
            panelContainerRect.x,
            panelContainerRect.y,
            panelContainerRect.width,
            panelContainerRect.height,
          );

          const zoomLevel = editor.getZoomLevel();
          const height = DEFAULT_HEIGHT * zoomLevel;
          const width = DEFAULT_WIDTH * zoomLevel;
          const isInside = Box.ContainsPoint(box, current.currentPosition);
          if (isInside) {
            imageRef.style.display = "none";
          } else {
            const viewportScreenBounds = editor.getViewportScreenBounds();
            imageRef.style.display = "flex";
            imageRef.style.position = "fixed";
            imageRef.style.pointerEvents = "none";
            imageRef.style.left = "0px";
            imageRef.style.top = "0px";
            imageRef.style.transform = `translate(${current.currentPosition.x - viewportScreenBounds.x - width / 2}px, ${current.currentPosition.y - viewportScreenBounds.y - height / 2}px)`;
            imageRef.style.width = `${width}px`;
            imageRef.style.height = `${height}px`;
            imageRef.style.zIndex = "9999";
            imageRef.style.borderRadius = `${16 * zoomLevel}px`;
            imageRef.style.backgroundColor = current.item.backgroundColor;
            imageRef.style.color = current.item.textColor;
            imageRef.className =
              "roamjs-tldraw-node pointer-events-none flex fixed items-center justify-center overflow-hidden";
          }
        }
      }
    },
    [dragState, editor],
  );

  // If it's a node tool, show only that node
  if (currentNodeTool) {
    return (
      <>
        <div className="tlui-layout__top__right">
          <div className="tlui-style-panel tlui-style-panel__wrapper">
            <div
              className="tlui-style-panel__row tlui-button tlui-button__icon flex h-5 cursor-pointer items-center gap-2 px-3"
              style={{
                justifyContent: "flex-start",
              }}
              onClick={() => editor.setCurrentTool("discourse-tool")}
            >
              <span
                className="tlui-icon tlui-button__icon mr-2"
                style={{
                  mask: `url("${NODE_COLOR_ICON_DATA_URL}") center 100% / 100% no-repeat`,
                  backgroundColor:
                    formatHexColor(currentNodeTool.canvasSettings.color) ||
                    "black",
                }}
              />
              <span>{currentNodeTool.text}</span>
            </div>
          </div>
        </div>
        <div ref={rDraggingImage} />
      </>
    );
  }

  // If it's a relation tool, show only that relation
  if (currentRelationTool) {
    const color = getRelationColor(
      currentRelationTool,
      uniqueRelations.indexOf(currentRelationTool),
    );
    return (
      <>
        <div className="tlui-layout__top__right">
          <div className="tlui-style-panel tlui-style-panel__wrapper">
            <div
              className="tlui-style-panel__row tlui-button tlui-button__icon flex h-5 cursor-pointer items-center gap-2 px-3"
              style={{
                justifyContent: "flex-start",
              }}
              onClick={() => editor.setCurrentTool("discourse-tool")}
            >
              <div
                className="tlui-icon tlui-button__icon mr-2"
                style={{
                  color,
                  mask: `url("${TOOL_ARROW_ICON_DATA_URL}") center 100% / 100% no-repeat`,
                }}
              ></div>
              <span>{currentRelationTool}</span>
            </div>
          </div>
        </div>
        <div ref={rDraggingImage} />
      </>
    );
  }

  return currentToolId === "discourse-tool" ? (
    <>
      <div className="tlui-layout__top__right">
        <div
          className="tlui-style-panel tlui-style-panel__wrapper"
          ref={rPanelContainer}
        >
          {/* Nodes Section */}
          <>
            {panelItems.map((item, index) => (
              <div
                title={item.type === "node" ? item.shortcut : ""}
                key={item.id}
                className="tlui-style-panel__row tlui-button tlui-button__icon flex h-5 cursor-pointer items-center gap-2 px-3"
                style={{
                  justifyContent: "flex-start",
                }}
                data-drag_item_index={index}
                onPointerDown={handlePointerDown}
                onPointerUp={handlePointerUp}
              >
                <span
                  className="tlui-icon tlui-button__icon mr-2"
                  style={{
                    mask:
                      item.type === "node"
                        ? `url("${NODE_COLOR_ICON_DATA_URL}") center 100% / 100% no-repeat`
                        : `url("${TOOL_ARROW_ICON_DATA_URL}") center 100% / 100% no-repeat`,
                    backgroundColor: item.color,
                  }}
                />
                <span>{item.text}</span>
              </div>
            ))}
          </>
        </div>
      </div>
      <div ref={rDraggingImage}>
        {state.name === "dragging" && (
          <div
            style={{
              ...DEFAULT_STYLE_PROPS,
              maxWidth: "",
              fontFamily: FONT_FAMILIES.sans,
              fontSize: `${FONT_SIZES.s * zoomLevel}px`,
              padding: `${40 * zoomLevel}px`,
            }}
          >
            {state.item.text}
          </div>
        )}
      </div>
    </>
  ) : null;
};

export default DiscourseGraphPanel;
