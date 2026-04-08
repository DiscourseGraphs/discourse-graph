import React, { useCallback, useEffect, useRef, useState } from "react";
import { TLShapeId, createShapeId, useEditor, useValue } from "tldraw";
import { DiscourseNodeShape } from "~/components/canvas/DiscourseNodeUtil";
import {
  BaseDiscourseRelationUtil,
  DiscourseRelationShape,
  getRelationColor,
} from "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil";
import { createOrUpdateArrowBinding } from "~/components/canvas/DiscourseRelationShape/helpers";
import {
  checkConnectionType,
  getAllRelations,
  hasValidRelationTypes,
  isDiscourseNodeShape,
} from "~/components/canvas/canvasUtils";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";
import { RelationTypeDropdown } from "./RelationTypeDropdown";

const HANDLE_RADIUS = 5;
const HANDLE_HIT_AREA = 12;
const HANDLE_PADDING = 8;

type HandlePosition = {
  x: number;
  y: number;
  anchor: { x: number; y: number };
  direction: { x: number; y: number };
};

/** Pending connection: source + target nodes identified, waiting for relation type pick */
type PendingConnection = {
  sourceId: TLShapeId;
  targetId: TLShapeId;
  /** Viewport coords for dropdown positioning (midpoint between nodes) */
  dropdownPos: { x: number; y: number };
};

const getEdgeMidpoints = (bounds: {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}): HandlePosition[] => [
  {
    x: (bounds.minX + bounds.maxX) / 2,
    y: bounds.minY,
    anchor: { x: 0.5, y: 0 },
    direction: { x: 0, y: -1 },
  },
  {
    x: bounds.maxX,
    y: (bounds.minY + bounds.maxY) / 2,
    anchor: { x: 1, y: 0.5 },
    direction: { x: 1, y: 0 },
  },
  {
    x: (bounds.minX + bounds.maxX) / 2,
    y: bounds.maxY,
    anchor: { x: 0.5, y: 1 },
    direction: { x: 0, y: 1 },
  },
  {
    x: bounds.minX,
    y: (bounds.minY + bounds.maxY) / 2,
    anchor: { x: 0, y: 0.5 },
    direction: { x: -1, y: 0 },
  },
];

export const DragHandleOverlay = () => {
  const editor = useEditor();

  // Drag state: track the drag line in viewport coords (no tldraw shapes)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [hoveredTarget, setHoveredTarget] = useState<TLShapeId | null>(null);

  // After a successful drop, show the relation type dropdown
  const [pending, setPending] = useState<PendingConnection | null>(null);

  const sourceNodeRef = useRef<DiscourseNodeShape | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  // Track the single selected discourse node
  const selectedNode = useValue<DiscourseNodeShape | null>(
    "dragHandleSelectedNode",
    () => {
      if (isDragging || pending) return sourceNodeRef.current;
      const shape = editor.getOnlySelectedShape();
      if (shape && isDiscourseNodeShape(editor, shape)) {
        return shape;
      }
      return null;
    },
    [editor, isDragging, pending],
  );

  // Compute handle positions in viewport space
  const handlePositions = useValue<
    { left: number; top: number; anchor: { x: number; y: number } }[] | null
  >(
    "dragHandlePositions",
    () => {
      if (!selectedNode || pending || isDragging) return null;
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
    [editor, selectedNode?.id, pending, isDragging],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!selectedNode) return;
      e.preventDefault();
      e.stopPropagation();
      e.nativeEvent.stopImmediatePropagation();

      sourceNodeRef.current = selectedNode;
      setIsDragging(true);

      const startVp = { x: e.clientX, y: e.clientY };
      // Get container bounding rect to convert client coords to overlay-relative
      const containerRect = editor.getContainer().getBoundingClientRect();
      setDragStart({
        x: startVp.x - containerRect.left,
        y: startVp.y - containerRect.top,
      });
      setDragEnd({
        x: startVp.x - containerRect.left,
        y: startVp.y - containerRect.top,
      });

      const containerEl = editor.getContainer();

      const onPointerMove = (moveEvent: PointerEvent) => {
        const rect = containerEl.getBoundingClientRect();
        setDragEnd({
          x: moveEvent.clientX - rect.left,
          y: moveEvent.clientY - rect.top,
        });

        // Check for target node under cursor
        const pagePoint = editor.screenToPage({
          x: moveEvent.clientX,
          y: moveEvent.clientY,
        });
        const target = editor.getShapeAtPoint(pagePoint, {
          hitInside: true,
          hitFrameInside: true,
          margin: 0,
          filter: (s) =>
            isDiscourseNodeShape(editor, s) &&
            s.id !== selectedNode.id &&
            !s.isLocked,
        });
        setHoveredTarget(target?.id ?? null);
        editor.setHintingShapes(target ? [target.id] : []);
      };

      const onPointerUp = (upEvent: PointerEvent) => {
        containerEl.removeEventListener("pointermove", onPointerMove);
        containerEl.removeEventListener("pointerup", onPointerUp);
        dragCleanupRef.current = null;
        editor.setHintingShapes([]);
        setIsDragging(false);
        setDragStart(null);
        setDragEnd(null);
        setHoveredTarget(null);

        // Check what we dropped on
        const pagePoint = editor.screenToPage({
          x: upEvent.clientX,
          y: upEvent.clientY,
        });
        const target = editor.getShapeAtPoint(pagePoint, {
          hitInside: true,
          hitFrameInside: true,
          margin: 0,
          filter: (s) =>
            isDiscourseNodeShape(editor, s) &&
            s.id !== selectedNode.id &&
            !s.isLocked,
        });

        if (!target) {
          dispatchToastEvent({
            id: "tldraw-drag-handle-warning",
            title: "Drop on a discourse node to create a relation",
            severity: "warning",
          });
          sourceNodeRef.current = null;
          return;
        }

        // Validate that relation types exist between these node types
        if (!hasValidRelationTypes(selectedNode.type, target.type)) {
          dispatchToastEvent({
            id: "tldraw-no-valid-relation",
            title: "No relation types are defined between these node types",
            severity: "warning",
          });
          sourceNodeRef.current = null;
          return;
        }

        // Compute dropdown position: midpoint between source and target in viewport space
        const sourceBounds = editor.getShapePageBounds(selectedNode.id);
        const targetBounds = editor.getShapePageBounds(target.id);
        if (!sourceBounds || !targetBounds) {
          sourceNodeRef.current = null;
          return;
        }
        const midPage = {
          x: (sourceBounds.midX + targetBounds.midX) / 2,
          y: (sourceBounds.midY + targetBounds.midY) / 2,
        };
        const midVp = editor.pageToViewport(midPage);

        setPending({
          sourceId: selectedNode.id,
          targetId: target.id,
          dropdownPos: midVp,
        });
      };

      containerEl.addEventListener("pointermove", onPointerMove);
      containerEl.addEventListener("pointerup", onPointerUp);
      dragCleanupRef.current = () => {
        containerEl.removeEventListener("pointermove", onPointerMove);
        containerEl.removeEventListener("pointerup", onPointerUp);
        dragCleanupRef.current = null;
      };
    },
    [selectedNode, editor],
  );

  const handleDropdownSelect = useCallback(
    (relationId: string) => {
      if (!pending) return;

      const selectedRelation = getAllRelations().find(
        (r) => r.id === relationId,
      );
      if (!selectedRelation) {
        setPending(null);
        sourceNodeRef.current = null;
        return;
      }

      const color = getRelationColor(selectedRelation.label);

      // Determine direction: if we dragged from the relation's destination type,
      // the arrow is in reverse and should display the complement label.
      const sourceNode = editor.getShape(pending.sourceId);
      const targetNode = editor.getShape(pending.targetId);
      const { isReverse } = checkConnectionType(
        selectedRelation,
        sourceNode?.type ?? "",
        targetNode?.type ?? "",
      );
      const label =
        isReverse && selectedRelation.complement
          ? selectedRelation.complement
          : selectedRelation.label;

      // Get source bounds for arrow positioning
      const sourceBounds = editor.getShapePageBounds(pending.sourceId);
      if (!sourceBounds) {
        setPending(null);
        sourceNodeRef.current = null;
        return;
      }

      // Create the real relation shape with the correct type
      const arrowId = createShapeId();
      editor.createShape<DiscourseRelationShape>({
        id: arrowId,
        type: relationId,
        x: sourceBounds.midX,
        y: sourceBounds.midY,
        props: {
          color,
          text: label,
          dash: "draw",
          size: "m",
          fill: "none",
          bend: 0,
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          labelPosition: 0.5,
          font: "draw",
          scale: 1,
        },
      });

      const newArrow = editor.getShape<DiscourseRelationShape>(arrowId);
      if (!newArrow) {
        setPending(null);
        sourceNodeRef.current = null;
        return;
      }

      // Bind start and end
      createOrUpdateArrowBinding(editor, newArrow, pending.sourceId, {
        terminal: "start",
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isPrecise: false,
        isExact: false,
      });
      createOrUpdateArrowBinding(editor, newArrow, pending.targetId, {
        terminal: "end",
        normalizedAnchor: { x: 0.5, y: 0.5 },
        isPrecise: false,
        isExact: false,
      });

      // Persist via handleCreateRelationsInRoam
      const util = editor.getShapeUtil(newArrow);
      if (
        util instanceof BaseDiscourseRelationUtil &&
        "handleCreateRelationsInRoam" in util
      ) {
        type UtilWithRoamPersistence = BaseDiscourseRelationUtil & {
          handleCreateRelationsInRoam: (args: {
            arrow: DiscourseRelationShape;
            targetId: TLShapeId;
          }) => Promise<void>;
        };
        void (util as UtilWithRoamPersistence).handleCreateRelationsInRoam({
          arrow: editor.getShape<DiscourseRelationShape>(arrowId) ?? newArrow,
          targetId: pending.targetId,
        });
      }

      editor.select(arrowId);
      setPending(null);
      sourceNodeRef.current = null;
    },
    [editor, pending],
  );

  const handleDropdownDismiss = useCallback(() => {
    setPending(null);
    if (sourceNodeRef.current) {
      editor.select(sourceNodeRef.current.id);
    }
    sourceNodeRef.current = null;
  }, [editor]);

  const showHandles = !!handlePositions && !pending && !isDragging;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {/* Drag handle dots */}
      {showHandles &&
        handlePositions.map((pos, i) => (
          <div
            key={i}
            onPointerDown={handlePointerDown}
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

      {/* SVG drag line while dragging */}
      {isDragging && dragStart && dragEnd && (
        <svg
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 19,
          }}
        >
          <line
            x1={dragStart.x}
            y1={dragStart.y}
            x2={dragEnd.x}
            y2={dragEnd.y}
            stroke={hoveredTarget ? "#339af0" : "#adb5bd"}
            strokeWidth={2}
            strokeDasharray={hoveredTarget ? "none" : "6 4"}
          />
          {/* Arrowhead */}
          <circle
            cx={dragEnd.x}
            cy={dragEnd.y}
            r={4}
            fill={hoveredTarget ? "#339af0" : "#adb5bd"}
          />
        </svg>
      )}

      {/* Relation type dropdown */}
      {pending && (
        <RelationTypeDropdown
          sourceId={pending.sourceId}
          targetId={pending.targetId}
          dropdownPos={pending.dropdownPos}
          onSelect={handleDropdownSelect}
          onDismiss={handleDropdownDismiss}
        />
      )}
    </div>
  );
};
