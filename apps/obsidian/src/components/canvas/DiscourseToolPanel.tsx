import {
  Box,
  Vec,
  useAtom,
  useEditor,
  useQuickReactor,
  useValue,
} from "tldraw";
import * as React from "react";
import { TFile } from "obsidian";
import DiscourseGraphPlugin from "~/index";
import { openCreateDiscourseNodeAt } from "./utils/nodeCreationFlow";
import { getNodeTypeById } from "~/utils/typeUtils";
import { useEffect } from "react";
import { setDiscourseNodeToolContext } from "./DiscourseNodeTool";
import {
  setDiscourseRelationToolContext,
  clearDiscourseRelationToolContext,
} from "./DiscourseRelationTool";
import { TOOL_ARROW_ICON_SVG } from "~/icons";

const TOOL_ARROW_ICON_DATA_URL = `data:image/svg+xml;base64,${btoa(TOOL_ARROW_ICON_SVG)}`;

export const DiscourseToolPanel = ({
  plugin,
  canvasFile,
}: {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
}) => {
  const editor = useEditor();
  const rPanelContainer = React.useRef<HTMLDivElement>(null);
  const rDraggingImage = React.useRef<HTMLDivElement>(null);
  const didDragRef = React.useRef(false);
  const [focusedNodeTypeId, setFocusedNodeTypeId] = React.useState<
    string | undefined
  >(undefined);
  const [focusedRelationTypeId, setFocusedRelationTypeId] = React.useState<
    string | undefined
  >(undefined);

  type DragState =
    | { name: "idle" }
    | { name: "pointing_item"; nodeTypeId: string; startPosition: Vec }
    | { name: "dragging"; nodeTypeId: string; currentPosition: Vec };

  const dragState = useAtom<DragState>("dgPanelDragState", () => ({
    name: "idle",
  }));

  const handlers = React.useMemo(() => {
    let target: HTMLButtonElement | null = null;

    const handlePointerMove = (e: PointerEvent) => {
      const current = dragState.get();
      const screenPoint = new Vec(e.clientX, e.clientY);
      switch (current.name) {
        case "idle":
          break;
        case "pointing_item": {
          const dist = Vec.Dist(screenPoint, current.startPosition);
          if (dist > 10) {
            didDragRef.current = true;
            dragState.set({
              name: "dragging",
              nodeTypeId: current.nodeTypeId,
              currentPosition: screenPoint,
            });
          }
          break;
        }
        case "dragging": {
          dragState.set({ ...current, currentPosition: screenPoint });
          break;
        }
      }
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
      dragState.set({ name: "idle" });
      didDragRef.current = false;
    };

    const onPointerUp = (e: React.PointerEvent) => {
      const current = dragState.get();
      target = e.currentTarget as HTMLButtonElement;
      target.releasePointerCapture(e.pointerId);

      switch (current.name) {
        case "idle":
          break;
        case "pointing_item": {
          dragState.set({ name: "idle" });
          break;
        }
        case "dragging": {
          e.preventDefault();
          e.stopPropagation();
          const screenPoint = new Vec(e.clientX, e.clientY);
          const pagePoint = editor.screenToPage(screenPoint);
          const nodeType = getNodeTypeById(plugin, current.nodeTypeId);
          if (nodeType) {
            openCreateDiscourseNodeAt({
              plugin,
              canvasFile,
              tldrawEditor: editor,
              position: pagePoint,
              initialNodeType: nodeType,
            });
          }
          dragState.set({ name: "idle" });
          // keep didDrag true through click phase; reset on next tick
          setTimeout(() => {
            didDragRef.current = false;
          }, 0);
          break;
        }
      }

      removeEventListeners();
    };

    const onPointerDown = (e: React.PointerEvent) => {
      e.preventDefault();
      target = e.currentTarget as HTMLButtonElement;
      target.setPointerCapture(e.pointerId);
      const nodeTypeId = target.dataset.dg_node_type_id!;
      if (!nodeTypeId) return;
      const startPosition = new Vec(e.clientX, e.clientY);
      dragState.set({ name: "pointing_item", nodeTypeId, startPosition });
      target.addEventListener("pointermove", handlePointerMove);
      document.addEventListener("keydown", handleKeyDown);
    };

    return { handlePointerDown: onPointerDown, handlePointerUp: onPointerUp };
  }, [dragState, editor, plugin, canvasFile]);

  const state = useValue("dgPanelDragState", () => dragState.get(), [
    dragState,
  ]);

  useQuickReactor(
    "dg-panel-drag-image-style",
    () => {
      const current = dragState.get();
      const imageRef = rDraggingImage.current;
      const panelRef = rPanelContainer.current;
      if (!imageRef || !panelRef) return;

      switch (current.name) {
        case "idle":
        case "pointing_item": {
          imageRef.style.display = "none";
          break;
        }
        case "dragging": {
          const panelRect = panelRef.getBoundingClientRect();
          const box = new Box(
            panelRect.x,
            panelRect.y,
            panelRect.width,
            panelRect.height,
          );
          const viewportScreenBounds = editor.getViewportScreenBounds();
          const isInside = Box.ContainsPoint(box, current.currentPosition);
          if (isInside) {
            imageRef.style.display = "none";
          } else {
            imageRef.style.display = "block";
            imageRef.style.position = "fixed";
            imageRef.style.pointerEvents = "none";
            imageRef.style.left = "0px";
            imageRef.style.top = "0px";
            imageRef.style.transform = `translate(${current.currentPosition.x - viewportScreenBounds.x - 25}px, ${current.currentPosition.y - viewportScreenBounds.y - 25}px)`;
            imageRef.style.width = "50px";
            imageRef.style.height = "50px";
            imageRef.style.display = "flex";
            imageRef.style.alignItems = "center";
          }
        }
      }
    },
    [dragState, editor],
  );

  const nodeTypes = plugin.settings.nodeTypes;
  const relationTypes = plugin.settings.relationTypes;

  useEffect(() => {
    if (!focusedNodeTypeId) return;
    const exists = !!getNodeTypeById(plugin, focusedNodeTypeId);
    if (!exists) setFocusedNodeTypeId(undefined);
  }, [focusedNodeTypeId, plugin]);

  const focusedNodeType = focusedNodeTypeId
    ? getNodeTypeById(plugin, focusedNodeTypeId)
    : null;

  // Only show the focused item, hide everything else when something is focused
  const displayNodeTypes = focusedNodeTypeId
    ? [focusedNodeType!]
    : focusedRelationTypeId
      ? []
      : nodeTypes;

  const displayRelationTypes = focusedRelationTypeId
    ? [relationTypes.find((rel) => rel.id === focusedRelationTypeId)!]
    : focusedNodeTypeId
      ? []
      : relationTypes;

  useEffect(() => {
    const cursor = focusedNodeTypeId ? "cross" : "default";
    editor.setCursor({ type: cursor });
    return () => {
      editor.setCursor({ type: "default" });
    };
  }, [focusedNodeTypeId, editor]);

  const handleItemClick = (id: string) => {
    if (didDragRef.current) return;

    // Clear other focus and toggle this one
    setFocusedRelationTypeId(undefined);
    clearDiscourseRelationToolContext();
    const shouldUnfocus = focusedNodeTypeId === id;
    setFocusedNodeTypeId(shouldUnfocus ? undefined : id);

    if (!shouldUnfocus) {
      setDiscourseNodeToolContext(editor, {
        plugin,
        canvasFile,
        nodeTypeId: id,
      });
      editor.setCurrentTool("discourse-node");
    }
  };

  const handleCreateRelationClick = (relationTypeId: string) => {
    // Clear other focus and toggle this one
    setFocusedNodeTypeId(undefined);
    const shouldUnfocus = focusedRelationTypeId === relationTypeId;
    setFocusedRelationTypeId(shouldUnfocus ? undefined : relationTypeId);

    if (shouldUnfocus) {
      clearDiscourseRelationToolContext();
      editor.setCurrentTool("select");
    } else {
      setDiscourseRelationToolContext({
        plugin,
        canvasFile,
        relationTypeId,
        onRelationComplete: () => {
          setFocusedRelationTypeId(undefined);
          editor.setCurrentTool("select");
        },
      });
      editor.setCurrentTool("discourse-relation");
    }
  };

  return (
    <div className="flex flex-row">
      <div className="tlui-layout__top__right">
        <div
          className="tlui-style-panel tlui-style-panel__wrapper"
          ref={rPanelContainer}
        >
          <div className="flex flex-col">
            {displayNodeTypes.map((nodeType) => (
              <NodeTypeButton
                key={nodeType.id}
                nodeType={nodeType}
                handlers={handlers}
                didDragRef={didDragRef}
                onClickNoDrag={() => handleItemClick(nodeType.id)}
              />
            ))}
            {displayRelationTypes.map((rel) => (
              <RelationTypeButton
                key={rel.id}
                relationType={rel}
                onClick={() => handleCreateRelationClick(rel.id)}
              />
            ))}
          </div>
          <div ref={rDraggingImage}>
            {state.name === "dragging"
              ? (getNodeTypeById(plugin, state.nodeTypeId)?.name ?? "")
              : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const NodeTypeButton = ({
  nodeType,
  handlers,
  didDragRef,
  onClickNoDrag,
}: NodeTypeButtonProps) => {
  return (
    <button
      key={nodeType.id}
      className="tlui-style-panel__row tlui-button flex h-5 cursor-pointer items-center !justify-start gap-2 px-3"
      data-dg_node_type_id={nodeType.id}
      onPointerDown={handlers.handlePointerDown}
      onPointerUp={handlers.handlePointerUp}
      onClick={() => {
        if (didDragRef.current) return;
        onClickNoDrag();
      }}
    >
      <span
        className="tlui-icon tlui-button__icon mr-2"
        style={{
          mask: `url("https://cdn.tldraw.com/2.3.0/icons/icon/color.svg") center 100% / 100% no-repeat`,
          backgroundColor: nodeType.color || "black",
        }}
      />
      <span className="text-sm">{nodeType.name}</span>
    </button>
  );
};

type NodeTypeSummary = {
  id: string;
  name: string;
  color?: string;
};

type NodeTypeButtonProps = {
  nodeType: NodeTypeSummary;
  handlers: {
    handlePointerDown: (e: React.PointerEvent) => void;
    handlePointerUp: (e: React.PointerEvent) => void;
  };
  didDragRef: React.MutableRefObject<boolean>;
  onClickNoDrag: () => void;
};

const RelationTypeButton = ({
  relationType,
  onClick,
}: {
  relationType: { id: string; label: string; color: string };
  onClick: () => void;
}) => {
  return (
    <button
      key={relationType.id}
      className="tlui-style-panel__row tlui-button flex h-5 cursor-pointer items-center !justify-start gap-2 px-3"
      onClick={onClick}
    >
      <span
        className="tlui-icon tlui-button__icon mr-2"
        style={{
          mask: `url("${TOOL_ARROW_ICON_DATA_URL}") center 100% / 100% no-repeat`,
          backgroundColor: relationType.color || "black",
        }}
      />
      <span className="text-sm">{relationType.label}</span>
    </button>
  );
};
