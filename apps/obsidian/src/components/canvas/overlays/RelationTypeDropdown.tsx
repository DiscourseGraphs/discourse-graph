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
  getDiscourseNodeTypeId,
  getValidRelationTypesForNodePair,
} from "~/components/canvas/utils/relationTypeUtils";
import { clampMenuCentre } from "~/components/canvas/utils/menuPlacement";

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
  const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);

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
  }, [hasPosition, isAddMenuOpen, relationTypeCount]);

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

  // Handle Escape key: close the add menu first, then the dropdown
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isAddMenuOpen) {
        e.stopPropagation();
        setIsAddMenuOpen(false);
        return;
      }
      onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isAddMenuOpen, onDismiss]);

  const handleSelect = useCallback(
    (relationTypeId: string) => {
      onSelect(relationTypeId);
    },
    [onSelect],
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
      <button className={actionClassName}>Add existing…</button>
      <button className={actionClassName}>Create new</button>
    </>
  );
  const hasRelationTypes = validRelationTypes.length > 0;

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
        <div className="flex items-center justify-between px-2 py-1">
          <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
            Relation type
          </span>
          {hasRelationTypes && (
            <button
              aria-label="Add relation type"
              aria-expanded={isAddMenuOpen}
              onClick={() => setIsAddMenuOpen((open) => !open)}
              className="flex h-auto cursor-pointer items-center rounded border-none bg-transparent p-0.5 text-gray-500 hover:bg-gray-100"
              ref={(el) => (el && setIcon(el, "plus")) || undefined}
            />
          )}
        </div>
        {hasRelationTypes
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
          : addActions}
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
