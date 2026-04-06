import { useCallback, useEffect, useMemo, useRef } from "react";
import { TLShapeId, useEditor, useValue } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseRelationShape } from "~/components/canvas/shapes/DiscourseRelationShape";
import {
  getArrowBindings,
  getArrowInfo,
} from "~/components/canvas/utils/relationUtils";
import {
  getDiscourseNodeTypeId,
  getValidRelationTypesForNodePair,
} from "~/components/canvas/utils/relationTypeUtils";

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

    const startNodeTypeId = getDiscourseNodeTypeId(startNode);
    const endNodeTypeId = getDiscourseNodeTypeId(endNode);

    if (!startNodeTypeId || !endNodeTypeId) return [];

    return getValidRelationTypesForNodePair({
      settings: plugin.settings,
      sourceNodeTypeId: startNodeTypeId,
      targetNodeTypeId: endNodeTypeId,
    });
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
      className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${dropdownPosition.left}px`,
        top: `${dropdownPosition.top}px`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="min-w-40 max-h-60 overflow-y-auto rounded-lg border bg-white p-1 shadow-lg">
        <div className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-gray-500">
          Relation Type
        </div>
        {validRelationTypes.map((rt) => (
          <button
            key={rt.id}
            onClick={() => handleSelect(rt.id)}
            className="flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: rt.color }}
            />
            {rt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
