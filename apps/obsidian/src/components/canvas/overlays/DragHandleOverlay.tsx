import { useCallback, useEffect, useRef } from "react";
import { TFile } from "obsidian";
import {
  createShapeId,
  useEditor,
  useValue,
  TLShapeId,
} from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseNodeShape } from "~/components/canvas/shapes/DiscourseNodeShape";
import { DiscourseRelationShape } from "~/components/canvas/shapes/DiscourseRelationShape";
import {
  getArrowBindings,
  createOrUpdateArrowBinding,
} from "~/components/canvas/utils/relationUtils";
import { DEFAULT_TLDRAW_COLOR } from "~/utils/tldrawColors";
import { RelationTypeDropdown } from "./RelationTypeDropdown";

type DragHandleOverlayProps = {
  plugin: DiscourseGraphPlugin;
  file: TFile;
};

type HandleDot = {
  id: string;
  pageX: number;
  pageY: number;
};

export const DragHandleOverlay = ({ plugin }: DragHandleOverlayProps) => {
  const editor = useEditor();
  const pendingArrowIdRef = useRef<TLShapeId | null>(null);
  const markIdRef = useRef<string>("");
  const isDraggingRef = useRef(false);

  const hasRelationTypes = plugin.settings.relationTypes.length > 0;

  // Track single-selected discourse-node
  const selectedNode = useValue<DiscourseNodeShape | null>(
    "dragHandleSelectedNode",
    () => {
      if (isDraggingRef.current) return null;
      const shape = editor.getOnlySelectedShape();
      if (shape && shape.type === "discourse-node") {
        return shape as DiscourseNodeShape;
      }
      return null;
    },
    [editor],
  );

  // Compute 4 handle dot positions in viewport coords
  const handleDots = useValue<HandleDot[] | null>(
    "dragHandleDots",
    () => {
      if (!selectedNode || !hasRelationTypes) return null;
      const bounds = editor.getSelectionRotatedPageBounds();
      if (!bounds) return null;

      const midpoints = [
        { id: "top", pageX: (bounds.minX + bounds.maxX) / 2, pageY: bounds.minY },
        { id: "right", pageX: bounds.maxX, pageY: (bounds.minY + bounds.maxY) / 2 },
        { id: "bottom", pageX: (bounds.minX + bounds.maxX) / 2, pageY: bounds.maxY },
        { id: "left", pageX: bounds.minX, pageY: (bounds.minY + bounds.maxY) / 2 },
      ];

      return midpoints.map((mp) => {
        const vp = editor.pageToViewport({ x: mp.pageX, y: mp.pageY });
        return { id: mp.id, pageX: vp.x, pageY: vp.y };
      });
    },
    [editor, selectedNode?.id],
  );

  // Check if the pending arrow has completed drag (both bindings exist)
  const pendingArrowState = useValue<"waiting" | "complete" | "none">(
    "pendingArrowState",
    () => {
      const pendingId = pendingArrowIdRef.current;
      if (!pendingId) return "none";

      const arrow = editor.getShape<DiscourseRelationShape>(pendingId);
      if (!arrow) {
        // Arrow was deleted
        pendingArrowIdRef.current = null;
        return "none";
      }

      const bindings = getArrowBindings(editor, arrow);
      if (bindings.start && bindings.end) {
        // Check that end is bound to a different discourse-node
        const endShape = editor.getShape(bindings.end.toId);
        if (
          endShape &&
          endShape.type === "discourse-node" &&
          bindings.start.toId !== bindings.end.toId
        ) {
          return "complete";
        }
      }
      return "waiting";
    },
    [editor],
  );

  // Clean up incomplete arrows when drag ends (no end binding)
  useEffect(() => {
    const handlePointerUp = () => {
      // Small delay to let tldraw finish processing the drag
      setTimeout(() => {
        const pendingId = pendingArrowIdRef.current;
        if (!pendingId || !isDraggingRef.current) return;
        isDraggingRef.current = false;

        const arrow = editor.getShape<DiscourseRelationShape>(pendingId);
        if (!arrow) {
          pendingArrowIdRef.current = null;
          return;
        }

        const bindings = getArrowBindings(editor, arrow);
        const endShape = bindings.end
          ? editor.getShape(bindings.end.toId)
          : null;

        // If no end binding, or end is not a discourse-node, or same node → delete
        if (
          !bindings.end ||
          !endShape ||
          endShape.type !== "discourse-node" ||
          (bindings.start && bindings.start.toId === bindings.end.toId)
        ) {
          editor.bailToMark(markIdRef.current);
          pendingArrowIdRef.current = null;
        }
      }, 50);
    };

    const container = editor.getContainer();
    container.addEventListener("pointerup", handlePointerUp);
    return () => container.removeEventListener("pointerup", handlePointerUp);
  }, [editor]);

  const handleDotPointerDown = useCallback(
    (e: React.PointerEvent, dot: HandleDot) => {
      e.stopPropagation();
      e.preventDefault();

      if (!selectedNode) return;

      isDraggingRef.current = true;

      const id = createShapeId();
      const markId = `drag-handle-creating:${id}`;
      markIdRef.current = markId;
      editor.mark(markId);

      // Get the page point for the dot (edge midpoint of selected node)
      const bounds = editor.getSelectionRotatedPageBounds();
      if (!bounds) return;

      // Map dot.id to actual page coords
      let pageX: number, pageY: number;
      switch (dot.id) {
        case "top":
          pageX = (bounds.minX + bounds.maxX) / 2;
          pageY = bounds.minY;
          break;
        case "right":
          pageX = bounds.maxX;
          pageY = (bounds.minY + bounds.maxY) / 2;
          break;
        case "bottom":
          pageX = (bounds.minX + bounds.maxX) / 2;
          pageY = bounds.maxY;
          break;
        case "left":
          pageX = bounds.minX;
          pageY = (bounds.minY + bounds.maxY) / 2;
          break;
        default:
          return;
      }

      // Create arrow shape without a relation type
      editor.createShape<DiscourseRelationShape>({
        id,
        type: "discourse-relation",
        x: pageX,
        y: pageY,
        props: {
          relationTypeId: "",
          text: "",
          color: DEFAULT_TLDRAW_COLOR,
          scale: editor.user.getIsDynamicResizeMode()
            ? 1 / editor.getZoomLevel()
            : 1,
        },
      });

      const shape = editor.getShape<DiscourseRelationShape>(id);
      if (!shape) return;

      // Bind start handle to the source node
      createOrUpdateArrowBinding(editor, shape, selectedNode.id, {
        terminal: "start",
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isPrecise: true,
        isExact: false,
        snap: "center",
      });

      // Set up end handle position
      const handles = editor.getShapeHandles(shape);
      if (!handles) return;

      const util = editor.getShapeUtil<DiscourseRelationShape>("discourse-relation");
      const endHandle = handles.find((h) => h.id === "end")!;
      const point = editor.getPointInShapeSpace(
        shape,
        { x: pageX, y: pageY },
      );
      const change = util.onHandleDrag?.(shape, {
        handle: { ...endHandle, x: point.x, y: point.y },
        isPrecise: false,
        initial: shape,
      });
      if (change) {
        editor.updateShapes([change]);
      }

      pendingArrowIdRef.current = id;
      editor.select(id);

      // Hand off to tldraw's dragging_handle state
      editor.setCurrentTool("select.dragging_handle", {
        shape: editor.getShape(id),
        handle: { id: "end", type: "vertex", index: "a3", x: 0, y: 0 },
        isCreating: true,
        onInteractionEnd: "select",
      });
    },
    [editor, selectedNode],
  );

  const handleRelationTypeSelected = useCallback(() => {
    pendingArrowIdRef.current = null;
  }, []);

  const handleDropdownDismiss = useCallback(() => {
    const pendingId = pendingArrowIdRef.current;
    if (pendingId && markIdRef.current) {
      editor.bailToMark(markIdRef.current);
    }
    pendingArrowIdRef.current = null;
  }, [editor]);

  const showDots = !!selectedNode && !!handleDots && !pendingArrowIdRef.current;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {showDots &&
        handleDots.map((dot) => (
          <div
            key={dot.id}
            onPointerDown={(e) => handleDotPointerDown(e, dot)}
            style={{
              position: "absolute",
              left: `${dot.pageX}px`,
              top: `${dot.pageY}px`,
              transform: "translate(-50%, -50%)",
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "var(--color-selected, #3b82f6)",
              border: "2px solid white",
              cursor: "crosshair",
              pointerEvents: "all",
              zIndex: 999,
              boxShadow: "0 0 2px rgba(0,0,0,0.3)",
            }}
          />
        ))}

      {pendingArrowState === "complete" && pendingArrowIdRef.current && (
        <RelationTypeDropdown
          editor={editor}
          plugin={plugin}
          arrowId={pendingArrowIdRef.current}
          onSelect={handleRelationTypeSelected}
          onDismiss={handleDropdownDismiss}
        />
      )}
    </div>
  );
};
