import { useCallback, useEffect, useRef } from "react";
import { Editor, TLShapeId, useValue } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseRelationShape, DiscourseRelationUtil } from "~/components/canvas/shapes/DiscourseRelationShape";
import { getArrowBindings, getArrowInfo } from "~/components/canvas/utils/relationUtils";
import { COLOR_PALETTE } from "~/utils/tldrawColors";
import { DiscourseRelationType } from "~/types";

type RelationTypeDropdownProps = {
  editor: Editor;
  plugin: DiscourseGraphPlugin;
  arrowId: TLShapeId;
  onSelect: () => void;
  onDismiss: () => void;
};

export const RelationTypeDropdown = ({
  editor,
  plugin,
  arrowId,
  onSelect,
  onDismiss,
}: RelationTypeDropdownProps) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position the dropdown at the arrow's midpoint in viewport coords
  const position = useValue<{ left: number; top: number } | null>(
    "dropdownPosition",
    () => {
      const arrow = editor.getShape<DiscourseRelationShape>(arrowId);
      if (!arrow) return null;

      const info = getArrowInfo(editor, arrow);
      if (!info) return null;

      // Get middle point in page space and convert to viewport
      const middlePage = {
        x: arrow.x + info.middle.x,
        y: arrow.y + info.middle.y,
      };
      const vp = editor.pageToViewport(middlePage);
      return { left: vp.x, top: vp.y };
    },
    [editor, arrowId],
  );

  // Filter relation types to only those valid for the connected node types
  const validRelationTypes = useValue<DiscourseRelationType[]>(
    "validRelationTypes",
    () => {
      const arrow = editor.getShape<DiscourseRelationShape>(arrowId);
      if (!arrow) return [];

      const bindings = getArrowBindings(editor, arrow);
      if (!bindings.start || !bindings.end) return [];

      const startNode = editor.getShape(bindings.start.toId);
      const endNode = editor.getShape(bindings.end.toId);
      if (!startNode || !endNode) return [];

      const startNodeTypeId = (startNode as { props?: { nodeTypeId?: string } })?.props?.nodeTypeId;
      const endNodeTypeId = (endNode as { props?: { nodeTypeId?: string } })?.props?.nodeTypeId;
      if (!startNodeTypeId || !endNodeTypeId) return [];

      // Find relation types that are valid for this pair of node types (in either direction)
      return plugin.settings.relationTypes.filter((rt) =>
        plugin.settings.discourseRelations.some(
          (dr) =>
            dr.relationshipTypeId === rt.id &&
            ((dr.sourceId === startNodeTypeId && dr.destinationId === endNodeTypeId) ||
              (dr.sourceId === endNodeTypeId && dr.destinationId === startNodeTypeId)),
        ),
      );
    },
    [editor, arrowId],
  );

  // Handle click outside to dismiss
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onDismiss();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };

    // Delay adding listeners so the pointerup from the drag doesn't immediately dismiss
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onDismiss]);

  // Auto-dismiss if arrow is deleted or selection changes
  useEffect(() => {
    const unsub = editor.store.listen(
      () => {
        const arrow = editor.getShape<DiscourseRelationShape>(arrowId);
        if (!arrow) {
          onDismiss();
        }
      },
      { source: "all", scope: "document" },
    );
    return unsub;
  }, [editor, arrowId, onDismiss]);

  const handleSelectRelationType = useCallback(
    (relationType: DiscourseRelationType) => {
      const arrow = editor.getShape<DiscourseRelationShape>(arrowId);
      if (!arrow) return;

      const bindings = getArrowBindings(editor, arrow);
      if (!bindings.start || !bindings.end) return;

      // Update arrow props with selected relation type
      editor.updateShapes([
        {
          id: arrow.id,
          type: arrow.type,
          props: {
            relationTypeId: relationType.id,
            text: relationType.label,
            color: relationType.color,
          },
        },
      ]);

      // Update text for direction (label vs complement)
      const updatedArrow = editor.getShape<DiscourseRelationShape>(arrowId);
      if (updatedArrow) {
        const util = editor.getShapeUtil(updatedArrow);
        if (util instanceof DiscourseRelationUtil) {
          const updatedBindings = getArrowBindings(editor, updatedArrow);
          util.updateRelationTextForDirection(updatedArrow, updatedBindings);

          // Reify to frontmatter
          util.reifyRelationInFrontmatter(updatedArrow, updatedBindings).catch((error) => {
            console.error("Failed to reify drag-handle relation:", error);
          });
        }
      }

      onSelect();
    },
    [editor, arrowId, onSelect],
  );

  if (!position || validRelationTypes.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "all",
        zIndex: 1000,
        backgroundColor: "var(--background-primary, #fff)",
        border: "1px solid var(--background-modifier-border, #ddd)",
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        padding: "4px 0",
        minWidth: 160,
      }}
    >
      <div
        style={{
          padding: "4px 12px",
          fontSize: 11,
          color: "var(--text-muted, #888)",
          fontWeight: 500,
        }}
      >
        Select relation type
      </div>
      {validRelationTypes.map((rt) => (
        <button
          key={rt.id}
          onClick={() => handleSelectRelationType(rt)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "6px 12px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 13,
            color: "var(--text-normal, #333)",
            textAlign: "left",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--background-modifier-hover, #f0f0f0)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: COLOR_PALETTE[rt.color] ?? COLOR_PALETTE["black"],
              flexShrink: 0,
            }}
          />
          <span>{rt.label}</span>
        </button>
      ))}
    </div>
  );
};
