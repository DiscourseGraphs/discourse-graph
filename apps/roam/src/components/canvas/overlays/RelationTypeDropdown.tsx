import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { TLShapeId, useEditor, DefaultColorThemePalette } from "tldraw";
import { getRelationColor } from "~/components/canvas/DiscourseRelationShape/DiscourseRelationUtil";
import {
  checkConnectionType,
  getAllRelations,
  isDiscourseNodeShape,
} from "~/components/canvas/canvasUtils";

type RelationTypeDropdownProps = {
  sourceId: TLShapeId;
  targetId: TLShapeId;
  dropdownPos: { x: number; y: number };
  onSelect: (relationId: string) => void;
  onDismiss: () => void;
};

export const RelationTypeDropdown = ({
  sourceId,
  targetId,
  dropdownPos,
  onSelect,
  onDismiss,
}: RelationTypeDropdownProps) => {
  const editor = useEditor();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get valid relation types based on source/target node types
  const validRelationTypes = useMemo(() => {
    const startNode = editor.getShape(sourceId);
    const endNode = editor.getShape(targetId);
    if (!startNode || !endNode) return [];

    const startNodeType = startNode.type;
    const endNodeType = endNode.type;

    // Verify both are discourse nodes
    if (
      !isDiscourseNodeShape(editor, startNode) ||
      !isDiscourseNodeShape(editor, endNode)
    )
      return [];

    const colorPalette = DefaultColorThemePalette.lightMode;
    const validTypes: { id: string; label: string; color: string }[] = [];
    const allRelations = getAllRelations();
    const seenLabels = new Set<string>();

    for (const relation of allRelations) {
      const { isDirect: isForward, isReverse } = checkConnectionType(
        relation,
        startNodeType,
        endNodeType,
      );

      if (!isForward && !isReverse) continue;

      const label =
        isReverse && relation.complement ? relation.complement : relation.label;

      if (!seenLabels.has(label)) {
        seenLabels.add(label);
        const tldrawColor = getRelationColor(relation.label);
        const hexColor = colorPalette[tldrawColor]?.solid ?? "#333";
        validTypes.push({ id: relation.id, label, color: hexColor });
      }
    }

    return validTypes;
  }, [editor, sourceId, targetId]);

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
    (relationId: string) => {
      onSelect(relationId);
    },
    [onSelect],
  );

  if (validRelationTypes.length === 0) return null;

  return (
    <div
      ref={dropdownRef}
      style={{
        position: "absolute",
        left: `${dropdownPos.x}px`,
        top: `${dropdownPos.y}px`,
        transform: "translate(-50%, -50%)",
        pointerEvents: "all",
        zIndex: 30,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-h-[240px] min-w-[160px] overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-lg">
        <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Relation Type
        </div>
        {validRelationTypes.map((rt) => (
          <button
            key={rt.id}
            onClick={() => handleSelect(rt.id)}
            className="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-3 py-2 text-left text-[13px] text-[#333] hover:bg-[#f0f0f0]"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "#f0f0f0";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor =
                "transparent";
            }}
          >
            <span
              style={{
                backgroundColor: rt.color,
              }}
              className="h-2 w-2 flex-shrink-0 rounded-full bg-[#333]"
            />
            {rt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
