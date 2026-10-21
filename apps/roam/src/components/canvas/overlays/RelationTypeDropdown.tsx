import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { TLShapeId, useEditor } from "tldraw";
import { getDiscourseNodeTypeId } from "~/components/canvas/DiscourseNodeUtil";
import {
  deriveRelationTypes,
  getNodeTypeText,
  type RelationType,
} from "~/components/canvas/existingRelationTypes";
import { CreateRelationTypeDialog } from "./CreateRelationTypeDialog";
import { getValidRelationTypesBetween } from "./relationCreation";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import { useRelationSchemaRevision } from "~/utils/relationSchemaChanges";

export type NodeTypePair = { sourceType: string; targetType: string };

type RelationTypeDropdownProps = {
  sourceId: TLShapeId;
  targetId: TLShapeId;
  dropdownPos: { x: number; y: number };
  onSelect: (relationId: string) => void;
  onDismiss: () => void;
  // Each action renders only when its handler is passed.
  // Resolves true once the type is saved, so the menu returns to the type list.
  onAddExisting?: (args: SaveRelationTypeArgs) => Promise<boolean>;
  onCreateNew?: (args: SaveRelationTypeArgs) => Promise<boolean>;
};

type SaveRelationTypeArgs = { pair: NodeTypePair; relationType: RelationType };

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
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const relationSchemaRevision = useRelationSchemaRevision();
  const validRelationTypes = useMemo(
    () => getValidRelationTypesBetween(editor, sourceId, targetId),
    // relationSchemaRevision re-reads discourseContext.relations after a schema change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor, sourceId, targetId, relationSchemaRevision],
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

  // Handle click outside; the dialog renders in a portal outside dropdownRef.
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (
        !isCreateOpen &&
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
  }, [onDismiss, isCreateOpen]);

  const existingRelationTypes = useMemo(
    () =>
      deriveRelationTypes({
        // Fresh settings, not discourseContext, which keeps removed relations for existing arrows.
        relations: getDiscourseRelations(),
        shownLabels: validRelationTypes.map((t) => t.label),
      }),
    [validRelationTypes],
  );

  // Escape leaves the picker first, then closes the menu.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // The dialog closes itself on Escape.
      if (e.key !== "Escape" || isCreateOpen) return;
      if (isPickerOpen) {
        e.stopPropagation();
        setIsPickerOpen(false);
      } else {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [onDismiss, isPickerOpen, isCreateOpen]);

  const handlePickExisting = async (
    relationType: RelationType,
  ): Promise<void> => {
    if (!pair || !onAddExisting || isSaving) return;
    setIsSaving(true);
    try {
      if (await onAddExisting({ pair, relationType })) {
        setIsPickerOpen(false);
        setIsActionMenuOpen(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

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
          run: () => {
            setIsActionMenuOpen(false);
            setIsPickerOpen(true);
          },
        },
        onCreateNew && {
          key: "create-new",
          label: "Create new",
          run: () => {
            setIsActionMenuOpen(false);
            setIsCreateOpen(true);
          },
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
  const createNewItem = actionItems.find((item) => item.key === "create-new");

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
          {!isEmpty && !isPickerOpen && actions.length > 0 && (
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
        {isPickerOpen && pair ? (
          <>
            <div className="flex items-center gap-1 px-2 py-1 text-sm text-gray-500">
              <button
                aria-label="Back to relation types"
                onClick={() => setIsPickerOpen(false)}
                className="cursor-pointer rounded border-none bg-transparent px-1 text-sm text-gray-500"
              >
                ‹
              </button>
              <span>
                {getNodeTypeText(pair.sourceType)} →{" "}
                {getNodeTypeText(pair.targetType)}
              </span>
            </div>
            {existingRelationTypes.length === 0 ? (
              <>
                <div className="px-3 py-2 text-sm text-gray-500">
                  No other relation types
                </div>
                {createNewItem}
              </>
            ) : (
              existingRelationTypes.map((rt) => (
                <MenuItem
                  key={JSON.stringify([rt.label, rt.complement])}
                  onClick={() => void handlePickExisting(rt)}
                >
                  {rt.label} / {rt.complement}
                </MenuItem>
              ))
            )}
          </>
        ) : isEmpty ? (
          actionItems.length > 0 ? (
            actionItems
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              No relation types between these nodes
            </div>
          )
        ) : (
          validRelationTypes.map((rt) => (
            <MenuItem key={rt.id} onClick={() => handleSelect(rt.id)}>
              <span
                style={{
                  backgroundColor: rt.color,
                }}
                className="h-2 w-2 flex-shrink-0 rounded-full bg-gray-800"
              />
              {rt.label}
            </MenuItem>
          ))
        )}
      </div>
      {/* Sibling of the menu so its overflow doesn't clip it, and inside dropdownRef for click-outside. */}
      {!isEmpty && isActionMenuOpen && (
        <div className="absolute left-full top-0 ml-1 whitespace-nowrap rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
          {actionItems}
        </div>
      )}
      {isCreateOpen && pair && onCreateNew && (
        <CreateRelationTypeDialog
          pair={pair}
          shownLabels={validRelationTypes.map((t) => t.label)}
          onClose={() => setIsCreateOpen(false)}
          onSubmit={async (relationType) => {
            const created = await onCreateNew({ pair, relationType });
            if (created) {
              setIsPickerOpen(false);
              setIsActionMenuOpen(false);
            }
            return created;
          }}
        />
      )}
    </div>
  );
};
