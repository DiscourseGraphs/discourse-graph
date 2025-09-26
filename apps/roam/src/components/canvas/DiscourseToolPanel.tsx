import React, { useMemo, useRef } from "react";
import {
  useEditor,
  useValue,
  useQuickReactor,
  Vec,
  Box,
  createShapeId,
} from "tldraw";
import { DiscourseNode } from "~/utils/getDiscourseNodes";
import { formatHexColor } from "~/components/settings/DiscourseNodeCanvasSettings";
import { getRelationColor } from "./DiscourseRelationShape/DiscourseRelationUtil";
import { useAtom } from "@tldraw/state";

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
        color: string;
      };
      currentPosition: Vec;
    };

const TOOL_ARROW_ICON_URL =
  "https://discoursegraphs.com/apps/assets/tool-arrow-icon.svg";
const NODE_COLOR_ICON_URL =
  "https://discoursegraphs.com/apps/assets/node-color-icon.svg";
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
    const nodeItems = nodes.map((node) => ({
      type: "node" as const,
      id: node.type,
      text: node.text,
      color: formatHexColor(node.canvasSettings.color) || "black",
      shortcut: node.shortcut,
    }));

    const relationItems = uniqueRelations.map((relation, index) => ({
      type: "relation" as const,
      id: relation,
      text: relation,
      color: getRelationColor(relation, index),
    }));

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

          if (current.item.type === "node") {
            const shapeId = createShapeId();
            editor.createShape({
              id: shapeId,
              type: current.item.id,
              x: pagePoint.x,
              y: pagePoint.y,
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
          const panelContainerRect = panelContainerRef.getBoundingClientRect();
          const box = new Box(
            panelContainerRect.x,
            panelContainerRect.y,
            panelContainerRect.width,
            panelContainerRect.height,
          );
          const viewportScreenBounds = editor.getViewportScreenBounds();
          const isInside = Box.ContainsPoint(box, current.currentPosition);
          if (isInside) {
            imageRef.style.display = "none";
          } else {
            imageRef.style.display = "block";
            imageRef.style.position = "absolute";
            imageRef.style.pointerEvents = "none";
            imageRef.style.left = "0px";
            imageRef.style.top = "0px";
            imageRef.style.transform = `translate(${current.currentPosition.x - viewportScreenBounds.x - 25}px, ${current.currentPosition.y - viewportScreenBounds.y - 25}px)`;
            imageRef.style.width = "50px";
            imageRef.style.height = "50px";
            imageRef.style.fontSize = "40px";
            imageRef.style.display = "flex";
            imageRef.style.alignItems = "center";
            imageRef.style.justifyContent = "center";
            imageRef.style.borderRadius = "8px";
            imageRef.style.backgroundColor = current.item.color;
            imageRef.style.color = "white";
            imageRef.style.fontWeight = "bold";
          }
        }
      }
    },
    [dragState],
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
                  mask: `url("${NODE_COLOR_ICON_URL}") center 100% / 100% no-repeat`,
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
                  mask: `url("${TOOL_ARROW_ICON_URL}") center 100% / 100% no-repeat`,
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
                        ? `url("${NODE_COLOR_ICON_URL}") center 100% / 100% no-repeat`
                        : `url("${TOOL_ARROW_ICON_URL}") center 100% / 100% no-repeat`,
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
              backgroundColor: state.item.color,
              color: "white",
              fontWeight: "bold",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
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
