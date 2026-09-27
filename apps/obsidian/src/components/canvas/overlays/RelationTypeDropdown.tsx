import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { setIcon } from "obsidian";
import { TLShapeId, useEditor, useValue } from "tldraw";
import DiscourseGraphPlugin from "~/index";
import { DiscourseRelationShape } from "~/components/canvas/shapes/DiscourseRelationShape";
import {
  getArrowBindings,
  getArrowInfo,
} from "~/components/canvas/utils/relationUtils";
import {
  associateRelationTypeWithNodePair,
  getAssociableRelationTypesForNodePair,
  getDiscourseNodeTypeId,
  getValidRelationTypesForNodePair,
} from "~/components/canvas/utils/relationTypeUtils";
import { showToast } from "~/components/canvas/utils/toastUtils";
import { getNodeTypeById } from "~/utils/typeUtils";
import type { DiscourseRelationType } from "~/types";
import { clampMenuCentre } from "~/components/canvas/utils/menuPlacement";

type RelationTypeDropdownProps = {
  arrowId: TLShapeId;
  plugin: DiscourseGraphPlugin;
  canvasPath: string;
  onSelect: (relationTypeId: string) => void;
  onDismiss: () => void;
};

export const RelationTypeDropdown = ({
  arrowId,
  plugin,
  canvasPath,
  onSelect,
  onDismiss,
}: RelationTypeDropdownProps) => {
  const editor = useEditor();
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
  const [isPickingExisting, setIsPickingExisting] = useState(false);

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

  const nodePair = useMemo(() => {
    if (!arrow) return null;

    const bindings = getArrowBindings(editor, arrow);
    if (!bindings.start || !bindings.end) return null;

    const sourceNodeTypeId = getDiscourseNodeTypeId(
      editor.getShape(bindings.start.toId),
    );
    const targetNodeTypeId = getDiscourseNodeTypeId(
      editor.getShape(bindings.end.toId),
    );
    if (!sourceNodeTypeId || !targetNodeTypeId) return null;

    return { sourceNodeTypeId, targetNodeTypeId };
  }, [arrow, editor]);

  // Associating replaces the discourseRelations array, so its identity refreshes both lists
  const { relationTypes, discourseRelations } = plugin.settings;
  const validRelationTypes = useMemo(
    () =>
      nodePair
        ? getValidRelationTypesForNodePair({
            settings: { relationTypes, discourseRelations },
            ...nodePair,
          })
        : [],
    [nodePair, relationTypes, discourseRelations],
  );
  const associableRelationTypes = useMemo(
    () =>
      nodePair
        ? getAssociableRelationTypesForNodePair({
            settings: { relationTypes, discourseRelations },
            ...nodePair,
          })
        : [],
    [nodePair, relationTypes, discourseRelations],
  );

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

  const viewport = useValue(
    "dropdownViewport",
    () => {
      const bounds = editor.getViewportScreenBounds();
      return { width: bounds.w, height: bounds.h };
    },
    [editor],
  );

  // Measured before paint so the first frame is already inside the canvas.
  const [menuSize, setMenuSize] = useState<{
    menu: { width: number; height: number };
    flyoutWidth: number;
  } | null>(null);
  const hasPosition = !!dropdownPosition;
  const relationTypeCount = validRelationTypes.length;
  const associableCount = associableRelationTypes.length;
  useLayoutEffect(() => {
    const [menu, flyout] = Array.from(
      dropdownRef.current?.children ?? [],
    ) as HTMLElement[];
    if (!menu) return;
    setMenuSize({
      menu: { width: menu.offsetWidth, height: menu.offsetHeight },
      flyoutWidth: flyout
        ? flyout.offsetLeft + flyout.offsetWidth - menu.offsetWidth
        : 0,
    });
  }, [
    hasPosition,
    isAddMenuOpen,
    isPickingExisting,
    relationTypeCount,
    associableCount,
  ]);

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

  // Handle Escape key: leave the picker or add menu first, then the dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isPickingExisting) {
        e.stopPropagation();
        setIsPickingExisting(false);
        return;
      }
      if (isAddMenuOpen) {
        e.stopPropagation();
        setIsAddMenuOpen(false);
        return;
      }
      onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isAddMenuOpen, isPickingExisting, onDismiss]);

  const handleSelect = useCallback(
    (relationTypeId: string) => {
      onSelect(relationTypeId);
    },
    [onSelect],
  );

  const handleAssociate = useCallback(
    async (relationType: DiscourseRelationType) => {
      if (!nodePair) return;
      try {
        await associateRelationTypeWithNodePair({
          plugin,
          relationTypeId: relationType.id,
          ...nodePair,
        });
      } catch {
        showToast({
          severity: "error",
          title: "Couldn't add relation",
          targetCanvasId: canvasPath,
        });
        return;
      }
      setIsPickingExisting(false);
      const sourceName =
        getNodeTypeById(plugin, nodePair.sourceNodeTypeId)?.name ?? "source";
      const targetName =
        getNodeTypeById(plugin, nodePair.targetNodeTypeId)?.name ?? "target";
      showToast({
        severity: "success",
        title: "Discourse relation added",
        description: `${relationType.label} relation added for ${sourceName} and ${targetName}`,
        targetCanvasId: canvasPath,
      });
    },
    [nodePair, plugin, canvasPath],
  );

  if (!dropdownPosition || !arrow) return null;

  const centre = menuSize
    ? clampMenuCentre({
        anchor: { x: dropdownPosition.left, y: dropdownPosition.top },
        ...menuSize,
        viewport,
        margin: 8,
      })
    : { x: dropdownPosition.left, y: dropdownPosition.top };

  const actionClassName =
    "flex w-full cursor-pointer items-center justify-start rounded border-none bg-transparent px-2 py-1.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-100";
  const addActions = (
    <>
      <button
        className={actionClassName}
        onClick={() => {
          setIsAddMenuOpen(false);
          setIsPickingExisting(true);
        }}
      >
        Add existing…
      </button>
      <button className={actionClassName}>Create new</button>
    </>
  );
  const hasRelationTypes = validRelationTypes.length > 0;
  const listContent = hasRelationTypes
    ? validRelationTypes.map((rt) => (
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
      ))
    : addActions;
  const pickerContent =
    associableRelationTypes.length > 0 ? (
      associableRelationTypes.map((rt) => (
        <button
          key={rt.id}
          onClick={() => void handleAssociate(rt)}
          className={actionClassName}
        >
          {rt.label} / {rt.complement}
        </button>
      ))
    ) : (
      <p className="m-0 px-2 py-1.5 text-sm text-gray-500">
        All relation types are already available for these nodes
      </p>
    );

  return (
    <div
      ref={dropdownRef}
      // Above tldraw's panels (z 300), below its menus (z 400). Arbitrary transform because preflight is off.
      className="pointer-events-auto absolute z-[301] [transform:translate(-50%,-50%)]"
      style={{
        left: `${centre.x}px`,
        top: `${centre.y}px`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-h-60 min-w-40 overflow-y-auto rounded-lg border bg-white p-1 shadow-lg">
        <div className="flex items-center justify-between gap-1 px-2 py-1">
          {isPickingExisting && (
            <button
              aria-label="Back to relation types"
              onClick={() => setIsPickingExisting(false)}
              className="flex h-auto cursor-pointer items-center rounded border-none bg-transparent p-0.5 text-gray-500 hover:bg-gray-100"
              ref={(el) => (el && setIcon(el, "chevron-left")) || undefined}
            />
          )}
          <span className="mr-auto text-xs font-medium uppercase tracking-wide text-gray-500">
            Relation type
          </span>
          {hasRelationTypes && !isPickingExisting && (
            <button
              aria-label="Add relation type"
              aria-expanded={isAddMenuOpen}
              onClick={() => setIsAddMenuOpen((open) => !open)}
              className="flex h-auto cursor-pointer items-center rounded border-none bg-transparent p-0.5 text-gray-500 hover:bg-gray-100"
              ref={(el) => (el && setIcon(el, "plus")) || undefined}
            />
          )}
        </div>
        {isPickingExisting ? pickerContent : listContent}
      </div>
      {/* Outside the scroll container so it isn't clipped, inside dropdownRef so clicks don't dismiss */}
      {hasRelationTypes && isAddMenuOpen && (
        <div className="absolute left-full top-0 ml-1 min-w-32 rounded-lg border bg-white p-1 shadow-lg">
          {addActions}
        </div>
      )}
    </div>
  );
};
