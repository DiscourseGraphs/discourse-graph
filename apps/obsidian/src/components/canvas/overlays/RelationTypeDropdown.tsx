import { useCallback, useEffect, useMemo, useRef } from "react";
import { TLShapeId, useEditor, useValue } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseRelationShape } from "~/components/canvas/shapes/DiscourseRelationShape";
import {
  getArrowBindings,
  getArrowInfo,
} from "~/components/canvas/utils/relationUtils";
import { COLOR_PALETTE } from "~/utils/tldrawColors";

type RelationTypeDropdownProps = {
  arrowId: TLShapeId;
  plugin: DiscourseGraphPlugin;
  onSelect: (relationTypeId: string) => void;
  onDismiss: () => void;
};

export const RelationTypeDropdown = ({
  arrowId,
  plugin,
  onSelect,
  onDismiss,
}: RelationTypeDropdownProps) => {
  const editor = useEditor();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const arrow = useValue<DiscourseRelationShape | null>(
    "dropdownArrow",
    () => editor.getShape<DiscourseRelationShape>(arrowId) ?? null,
    [editor, arrowId],
  );

  // Auto-dismiss if arrow is deleted
  useEffect(() => {
    if (!arrow) {
      onDismiss();
    }
  }, [arrow, onDismiss]);

  // Get valid relation types based on source/target node types
  const validRelationTypes = useMemo(() => {
    if (!arrow) return [];

    const bindings = getArrowBindings(editor, arrow);
    if (!bindings.start || !bindings.end) return [];

    const startNode = editor.getShape(bindings.start.toId);
    const endNode = editor.getShape(bindings.end.toId);

    if (!startNode || !endNode) return [];

    const startNodeTypeId = (startNode as { props?: { nodeTypeId?: string } })
      ?.props?.nodeTypeId;
    const endNodeTypeId = (endNode as { props?: { nodeTypeId?: string } })
      ?.props?.nodeTypeId;

    if (!startNodeTypeId || !endNodeTypeId) return [];

    // Find relation types that are valid for this node type pair
    const validTypes: {
      id: string;
      label: string;
      color: string;
    }[] = [];

    for (const relationType of plugin.settings.relationTypes) {
      // Check if there's a discourse relation that matches this pair
      const isValid = plugin.settings.discourseRelations.some(
        (relation) =>
          relation.relationshipTypeId === relationType.id &&
          ((relation.sourceId === startNodeTypeId &&
            relation.destinationId === endNodeTypeId) ||
            (relation.sourceId === endNodeTypeId &&
              relation.destinationId === startNodeTypeId)),
      );

      if (isValid) {
        validTypes.push({
          id: relationType.id,
          label: relationType.label,
          color: COLOR_PALETTE[relationType.color] ?? COLOR_PALETTE["black"]!,
        });
      }
    }

    return validTypes;
  }, [arrow, editor, plugin]);

  // Position dropdown at arrow midpoint
  const dropdownPosition = useValue<{ left: number; top: number } | null>(
    "dropdownPosition",
    () => {
      if (!arrow) return null;

      const info = getArrowInfo(editor, arrow);
      if (!info) return null;

      // Get the midpoint in page space
      const pageTransform = editor.getShapePageTransform(arrow.id);
      const midInPage = pageTransform.applyToPoint(info.middle);

      const vp = editor.pageToViewport(midInPage);
      return { left: vp.x, top: vp.y };
    },
    [editor, arrow?.id],
  );

  // Handle click outside
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        onDismiss();
      }
    };

    // Delay to avoid immediately triggering from the pointer up that opened this
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", handlePointerDown, true);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [onDismiss]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onDismiss]);

  const handleSelect = useCallback(
    (relationTypeId: string) => {
      onSelect(relationTypeId);
    },
    [onSelect],
  );

  if (!dropdownPosition || !arrow) return null;

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "absolute",
        left: `${dropdownPosition.left}px`,
        top: `${dropdownPosition.top}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "all",
        zIndex: 30,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          backgroundColor: "var(--color-background, #fff)",
          border: "1px solid var(--color-border, #e0e0e0)",
          borderRadius: "8px",
          boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
          padding: "4px",
          minWidth: "160px",
          maxHeight: "240px",
          overflowY: "auto",
        }}
      >
        <div
          style={{
            padding: "4px 8px",
            fontSize: "11px",
            color: "var(--color-text-lighter, #999)",
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          Relation Type
        </div>
        {validRelationTypes.map((rt) => (
          <button
            key={rt.id}
            onClick={() => handleSelect(rt.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              width: "100%",
              padding: "6px 8px",
              border: "none",
              borderRadius: "4px",
              backgroundColor: "transparent",
              cursor: "pointer",
              fontSize: "13px",
              color: "var(--color-text, #333)",
              textAlign: "left",
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.backgroundColor =
                "var(--color-hover, #f0f0f0)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: rt.color,
                flexShrink: 0,
              }}
            />
            {rt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
