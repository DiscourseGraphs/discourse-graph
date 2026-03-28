import { useCallback, useEffect, useRef, useState } from "react";
import { TFile } from "obsidian";
import {
  TLArrowBindingProps,
  TLShapeId,
  createShapeId,
  useEditor,
  useValue,
} from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseNodeShape } from "~/components/canvas/shapes/DiscourseNodeShape";
import {
  DiscourseRelationShape,
  DiscourseRelationUtil,
} from "~/components/canvas/shapes/DiscourseRelationShape";
import {
  createOrUpdateArrowBinding,
  getArrowBindings,
} from "~/components/canvas/utils/relationUtils";
import { DEFAULT_TLDRAW_COLOR } from "~/utils/tldrawColors";
import { showToast } from "~/components/canvas/utils/toastUtils";
import { hasValidRelationTypeForNodePair } from "~/components/canvas/utils/relationTypeUtils";
import { RelationTypeDropdown } from "./RelationTypeDropdown";

type DragHandleOverlayProps = {
  plugin: DiscourseGraphPlugin;
  file: TFile;
};

type HandlePosition = {
  x: number;
  y: number;
  anchor: { x: number; y: number };
};

const HANDLE_RADIUS = 5;
const HANDLE_HIT_AREA = 12;
const HANDLE_PADDING = 8; // px offset in viewport space, outward from the node edge

/** Page-space edge midpoints and their outward direction vectors. */
const getEdgeMidpoints = (bounds: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): (HandlePosition & { direction: { x: number; y: number } })[] => {
  return [
    // Top
    {
      x: (bounds.minX + bounds.maxX) / 2,
      y: bounds.minY,
      anchor: { x: 0.5, y: 0 },
      direction: { x: 0, y: -1 },
    },
    // Right
    {
      x: bounds.maxX,
      y: (bounds.minY + bounds.maxY) / 2,
      anchor: { x: 1, y: 0.5 },
      direction: { x: 1, y: 0 },
    },
    // Bottom
    {
      x: (bounds.minX + bounds.maxX) / 2,
      y: bounds.maxY,
      anchor: { x: 0.5, y: 1 },
      direction: { x: 0, y: 1 },
    },
    // Left
    {
      x: bounds.minX,
      y: (bounds.minY + bounds.maxY) / 2,
      anchor: { x: 0, y: 0.5 },
      direction: { x: -1, y: 0 },
    },
  ];
};

export const DragHandleOverlay = ({ plugin, file }: DragHandleOverlayProps) => {
  const editor = useEditor();
  const [pendingArrowId, setPendingArrowId] = useState<TLShapeId | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const sourceNodeRef = useRef<DiscourseNodeShape | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  // Clean up drag listeners on unmount
  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  // Track the single selected discourse node — mirrors RelationsOverlay pattern
  const selectedNode = useValue<DiscourseNodeShape | null>(
    "dragHandleSelectedNode",
    () => {
      const shape = editor.getOnlySelectedShape();
      if (shape && shape.type === "discourse-node") {
        return shape as DiscourseNodeShape;
      }
      return null;
    },
    [editor],
  );

  const handlePositions = useValue<
    { left: number; top: number; anchor: { x: number; y: number } }[] | null
  >(
    "dragHandlePositions",
    () => {
      if (!selectedNode || pendingArrowId || isDragging) return null;
      const bounds = editor.getShapePageBounds(selectedNode.id);
      if (!bounds) return null;
      const midpoints = getEdgeMidpoints(bounds);
      return midpoints.map((mp) => {
        const vp = editor.pageToViewport({ x: mp.x, y: mp.y });
        return {
          left: vp.x + mp.direction.x * HANDLE_PADDING,
          top: vp.y + mp.direction.y * HANDLE_PADDING,
          anchor: mp.anchor,
        };
      });
    },
    [editor, selectedNode?.id, pendingArrowId, isDragging],
  );

  const cleanupArrow = useCallback(
    (arrowId: TLShapeId) => {
      if (editor.getShape(arrowId)) {
        editor.deleteShapes([arrowId]);
      }
    },
    [editor],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent, anchor: { x: number; y: number }) => {
      if (!selectedNode) return;
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      sourceNodeRef.current = selectedNode;

      const arrowId = createShapeId();

      // Get the source node's page bounds for start position
      const sourceBounds = editor.getShapePageBounds(selectedNode.id);
      if (!sourceBounds) {
        setIsDragging(false);
        return;
      }

      const startX = sourceBounds.minX + anchor.x * sourceBounds.width;
      const startY = sourceBounds.minY + anchor.y * sourceBounds.height;

      // Create the arrow shape at the source node's position
      editor.createShape<DiscourseRelationShape>({
        id: arrowId,
        type: "discourse-relation",
        x: startX,
        y: startY,
        props: {
          color: DEFAULT_TLDRAW_COLOR,
          relationTypeId: "",
          text: "",
          dash: "draw",
          size: "m",
          fill: "none",
          labelColor: "black",
          bend: 0,
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          labelPosition: 0.5,
          font: "draw",
          scale: 1,
          kind: "arc",
          elbowMidPoint: 0,
        },
      });

      const createdShape = editor.getShape<DiscourseRelationShape>(arrowId);
      if (!createdShape) {
        setIsDragging(false);
        return;
      }

      // Bind the start handle to the source node
      createOrUpdateArrowBinding(editor, createdShape, selectedNode.id, {
        terminal: "start",
        normalizedAnchor: anchor,
        isPrecise: false,
        isExact: false,
        snap: "none",
      });

      // Select the arrow and start dragging the end handle
      editor.select(arrowId);

      // Use tldraw's built-in handle dragging by setting the tool state
      // We need to track the pointer to update the end handle
      const containerEl = editor.getContainer();
      const onPointerMove = (moveEvent: PointerEvent) => {
        const point = editor.screenToPage({
          x: moveEvent.clientX,
          y: moveEvent.clientY,
        });

        // Update the arrow's end position
        const currentShape = editor.getShape<DiscourseRelationShape>(arrowId);
        if (!currentShape) return;

        const dx = point.x - currentShape.x;
        const dy = point.y - currentShape.y;

        // Check for a target shape under the cursor
        const target = editor.getShapeAtPoint(point, {
          hitInside: true,
          hitFrameInside: true,
          margin: 0,
          filter: (targetShape) => {
            return (
              targetShape.type === "discourse-node" &&
              targetShape.id !== selectedNode.id &&
              !targetShape.isLocked
            );
          },
        });

        if (target) {
          // Bind end to target
          createOrUpdateArrowBinding(editor, currentShape, target.id, {
            terminal: "end",
            normalizedAnchor: { x: 0.5, y: 0.5 },
            isPrecise: false,
            isExact: false,
            snap: "none",
          });
          editor.setHintingShapes([target.id]);
        } else {
          // Update free end position
          // Remove any existing end binding
          const bindings = getArrowBindings(editor, currentShape);
          if (bindings.end) {
            editor.deleteBindings(
              editor
                .getBindingsFromShape(currentShape.id, "discourse-relation")
                .filter(
                  (b) => (b.props as TLArrowBindingProps).terminal === "end",
                ),
            );
          }
          editor.updateShapes([
            {
              id: arrowId,
              type: "discourse-relation",
              props: { end: { x: dx, y: dy } },
            },
          ]);
          editor.setHintingShapes([]);
        }
      };

      const onPointerUp = () => {
        containerEl.removeEventListener("pointermove", onPointerMove);
        containerEl.removeEventListener("pointerup", onPointerUp);
        dragCleanupRef.current = null;
        editor.setHintingShapes([]);
        setIsDragging(false);

        const finalShape = editor.getShape<DiscourseRelationShape>(arrowId);
        if (!finalShape) return;

        const bindings = getArrowBindings(editor, finalShape);

        // Validate: both ends bound to different discourse nodes
        if (
          bindings.start &&
          bindings.end &&
          bindings.start.toId !== bindings.end.toId
        ) {
          const endTarget = editor.getShape(bindings.end.toId);
          if (endTarget && endTarget.type === "discourse-node") {
            // Check if any relation types are valid for this node pair
            const startNodeTypeId = (
              editor.getShape(bindings.start.toId) as {
                props?: { nodeTypeId?: string };
              }
            )?.props?.nodeTypeId;
            const endNodeTypeId = (
              endTarget as { props?: { nodeTypeId?: string } }
            )?.props?.nodeTypeId;

            const hasValidRelationType =
              startNodeTypeId &&
              endNodeTypeId &&
              hasValidRelationTypeForNodePair(
                plugin.settings,
                startNodeTypeId,
                endNodeTypeId,
              );

            if (!hasValidRelationType) {
              cleanupArrow(arrowId);
              showToast({
                severity: "warning",
                title: "Relation",
                description:
                  "No relation types are defined between these node types",
                targetCanvasId: file.path,
              });
              if (sourceNodeRef.current) {
                editor.select(sourceNodeRef.current.id);
              }
              sourceNodeRef.current = null;
              return;
            }

            // Success - show dropdown to pick relation type
            setPendingArrowId(arrowId);
            editor.select(arrowId);
            return;
          }
        }

        // Failure - clean up the arrow and show notice
        cleanupArrow(arrowId);
        showToast({
          severity: "warning",
          title: "Relation",
          description: !bindings.end
            ? "Drop on a discourse node to create a relation"
            : "Target must be a different discourse node",
          targetCanvasId: file.path,
        });
        // Re-select the source node
        if (sourceNodeRef.current) {
          editor.select(sourceNodeRef.current.id);
        }
        sourceNodeRef.current = null;
      };

      containerEl.addEventListener("pointermove", onPointerMove);
      containerEl.addEventListener("pointerup", onPointerUp);

      dragCleanupRef.current = () => {
        containerEl.removeEventListener("pointermove", onPointerMove);
        containerEl.removeEventListener("pointerup", onPointerUp);
        dragCleanupRef.current = null;
      };
    },
    [
      selectedNode,
      editor,
      cleanupArrow,
      file.path,
      plugin.settings,
    ],
  );

  const handleDropdownSelect = useCallback(
    (relationTypeId: string) => {
      if (!pendingArrowId) return;

      const shape = editor.getShape<DiscourseRelationShape>(pendingArrowId);
      if (!shape) {
        setPendingArrowId(null);
        return;
      }

      const relationType = plugin.settings.relationTypes.find(
        (rt) => rt.id === relationTypeId,
      );
      if (!relationType) {
        cleanupArrow(pendingArrowId);
        setPendingArrowId(null);
        return;
      }

      // Update arrow props with relation type info
      editor.updateShapes([
        {
          id: pendingArrowId,
          type: "discourse-relation",
          props: {
            relationTypeId,
            color: relationType.color,
          },
        },
      ]);

      // Get updated shape and bindings for text direction
      const updatedShape =
        editor.getShape<DiscourseRelationShape>(pendingArrowId);
      if (updatedShape) {
        const bindings = getArrowBindings(editor, updatedShape);

        // Update text based on direction
        const util = editor.getShapeUtil(updatedShape);
        if (util instanceof DiscourseRelationUtil) {
          util.updateRelationTextForDirection(updatedShape, bindings);
          // Persist to relations JSON
          void util.reifyRelation(updatedShape, bindings);
        }
      }

      setPendingArrowId(null);
      sourceNodeRef.current = null;
    },
    [editor, pendingArrowId, plugin, cleanupArrow],
  );

  const handleDropdownDismiss = useCallback(() => {
    if (pendingArrowId) {
      cleanupArrow(pendingArrowId);
      setPendingArrowId(null);
    }
    // Re-select source node
    if (sourceNodeRef.current) {
      editor.select(sourceNodeRef.current.id);
    }
    sourceNodeRef.current = null;
  }, [editor, pendingArrowId, cleanupArrow]);

  const showHandles = !!handlePositions && !pendingArrowId;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Drag handle dots */}
      {showHandles &&
        handlePositions.map((pos, i) => (
          <div
            key={i}
            onPointerDown={(e) => handlePointerDown(e, pos.anchor)}
            style={{
              position: "absolute",
              left: `${pos.left}px`,
              top: `${pos.top}px`,
              transform: "translate(-50%, -50%)",
              width: `${HANDLE_HIT_AREA * 2}px`,
              height: `${HANDLE_HIT_AREA * 2}px`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "crosshair",
              pointerEvents: "all",
              zIndex: 20,
            }}
          >
            <div
              style={{
                width: `${HANDLE_RADIUS * 2}px`,
                height: `${HANDLE_RADIUS * 2}px`,
                borderRadius: "50%",
                backgroundColor: "#adb5bd",
              }}
            />
          </div>
        ))}

      {/* Relation type dropdown */}
      {pendingArrowId && (
        <RelationTypeDropdown
          arrowId={pendingArrowId}
          plugin={plugin}
          onSelect={handleDropdownSelect}
          onDismiss={handleDropdownDismiss}
        />
      )}
    </div>
  );
};
