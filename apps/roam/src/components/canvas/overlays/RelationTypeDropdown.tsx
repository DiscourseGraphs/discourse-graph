import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TLShapeId, useEditor } from "tldraw";
import { getDiscourseNodeTypeId } from "~/components/canvas/DiscourseNodeUtil";
import { getValidRelationTypesBetween } from "./relationCreation";

export type NodeTypePair = { sourceType: string; targetType: string };

type RelationTypeDropdownProps = {
  sourceId: TLShapeId;
  targetId: TLShapeId;
  dropdownPos: { x: number; y: number };
  onSelect: (relationId: string) => void;
  onDismiss: () => void;
  // Each action renders only when its handler is passed.
  onAddExisting?: (pair: NodeTypePair) => void;
  onCreateNew?: (pair: NodeTypePair) => void;
};

const MenuItem = ({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}): React.ReactElement => (
  <button
    onClick={onClick}
    className="flex w-full cursor-pointer items-center gap-2 rounded-md border-none bg-transparent px-3 py-2 text-left text-sm text-gray-800 hover:bg-gray-100"
  >
    {children}
  </button>
);

export const RelationTypeDropdown = ({
  sourceId,
  targetId,
  dropdownPos,
  onSelect,
  onDismiss,
  onAddExisting,
  onCreateNew,
}: RelationTypeDropdownProps) => {
  const editor = useEditor();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const validRelationTypes = useMemo(
    () => getValidRelationTypesBetween(editor, sourceId, targetId),
    [editor, sourceId, targetId],
  );

  const pair = useMemo<NodeTypePair | null>(() => {
    const source = editor.getShape(sourceId);
    const target = editor.getShape(targetId);
    if (!source || !target) return null;
    return {
      sourceType: getDiscourseNodeTypeId({ shape: source }),
      targetType: getDiscourseNodeTypeId({ shape: target }),
    };
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

  const actions = pair
    ? [
        onAddExisting && {
          key: "add-existing",
          label: "Add existing…",
          run: () => onAddExisting(pair),
        },
        onCreateNew && {
          key: "create-new",
          label: "Create new",
          run: () => onCreateNew(pair),
        },
      ].filter((a): a is { key: string; label: string; run: () => void } =>
        Boolean(a),
      )
    : [];
  const isEmpty = validRelationTypes.length === 0;
  const actionItems = actions.map((a) => (
    <MenuItem key={a.key} onClick={a.run}>
      {a.label}
    </MenuItem>
  ));

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
      <div
        // Tailwind 2's min-w scale has no fixed widths.
        style={{ minWidth: 160 }}
        className="max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white p-4 shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <span>Relation Type</span>
          {!isEmpty && actions.length > 0 && (
            <button
              aria-label="Add relation type"
              aria-expanded={isActionMenuOpen}
              onClick={() => setIsActionMenuOpen((open) => !open)}
              className="cursor-pointer rounded border-none bg-transparent px-1 text-sm text-gray-500"
            >
              +
            </button>
          )}
        </div>
        {isEmpty ? (
          actionItems.length > 0 ? (
            actionItems
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              No relation types between these nodes
            </div>
          )
        ) : (
          <>
            {isActionMenuOpen && (
              <div className="mb-1 border-b border-gray-200 pb-1">
                {actionItems}
              </div>
            )}
            {validRelationTypes.map((rt) => (
              <MenuItem key={rt.id} onClick={() => handleSelect(rt.id)}>
                <span
                  style={{
                    backgroundColor: rt.color,
                  }}
                  className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-800"
                />
                {rt.label}
              </MenuItem>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
