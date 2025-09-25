/* Note: Most functions here are copied and modified from tldraw Arrow binding util 3.14.2
https://github.com/tldraw/tldraw/blob/main/packages/tldraw/src/lib/bindings/arrow/ArrowBindingUtil.ts
 */
import {
  TLBaseBinding,
  TLArrowBindingProps,
  BindingUtil,
  arrowBindingProps,
  BindingOnCreateOptions,
  BindingOnChangeOptions,
  BindingOnShapeChangeOptions,
  BindingOnShapeIsolateOptions,
  Editor,
  TLArcInfo,
  TLArrowPoint,
  VecLike,
  IndexKey,
  TLParentId,
  TLShape,
  TLShapeId,
  getIndexAbove,
  getIndexBetween,
  TLShapePartial,
  Vec,
  approximately,
  BindingOnShapeDeleteOptions,
} from "tldraw";
import {
  DiscourseRelationShape,
  DiscourseRelationUtil,
} from "./DiscourseRelationShape";
import {
  assert,
  getArrowBindings,
  getArrowInfo,
  removeArrowBinding,
} from "~/components/canvas/utils/relationUtils";

export type RelationBindings = {
  start: RelationBinding | undefined;
  end: RelationBinding | undefined;
};

export type RelationInfo =
  | {
      bindings: RelationBindings;
      isStraight: false;
      start: TLArrowPoint;
      end: TLArrowPoint;
      middle: VecLike;
      handleArc: TLArcInfo;
      bodyArc: TLArcInfo;
      isValid: boolean;
    }
  | {
      bindings: RelationBindings;
      isStraight: true;
      start: TLArrowPoint;
      end: TLArrowPoint;
      middle: VecLike;
      isValid: boolean;
      length: number;
    };

export type RelationBinding = TLBaseBinding<string, TLArrowBindingProps>;
export class BaseRelationBindingUtil extends BindingUtil<RelationBinding> {
  static override props = arrowBindingProps;
  private static reifiedArrows = new Set<string>();

  override getDefaultProps(): Partial<TLArrowBindingProps> {
    return {
      isPrecise: false,
      isExact: false,
      normalizedAnchor: { x: 0.5, y: 0.5 },
      snap: "center",
    };
  }

  // when the binding itself changes
  override onAfterCreate({
    binding,
  }: BindingOnCreateOptions<RelationBinding>): void {
    const arrow = this.editor.getShape(
      binding.fromId,
    ) as DiscourseRelationShape;
    arrowDidUpdate(this.editor, arrow);
  }

  // when the binding itself changes
  override onAfterChange({
    bindingAfter,
  }: BindingOnChangeOptions<RelationBinding>): void {
    arrowDidUpdate(
      this.editor,
      this.editor.getShape(bindingAfter.fromId) as DiscourseRelationShape,
    );
  }

  // when the arrow itself changes
  override onAfterChangeFromShape({
    shapeAfter,
  }: BindingOnShapeChangeOptions<RelationBinding>): void {
    arrowDidUpdate(this.editor, shapeAfter as DiscourseRelationShape);
  }

  // when the shape an arrow is bound to changes
  override onAfterChangeToShape({
    binding,
  }: BindingOnShapeChangeOptions<RelationBinding>): void {
    reparentArrow(this.editor, binding.fromId);
  }

  // when the arrow is isolated we need to update it's x,y positions
  override onBeforeIsolateFromShape({
    binding,
  }: BindingOnShapeIsolateOptions<RelationBinding>): void {
    const arrow = this.editor.getShape<DiscourseRelationShape>(binding.fromId);
    if (!arrow) return;
    // this.editor.deleteShape(arrow.id); // we don't want to keep the arrow
    // Clean up tracking when arrow becomes unbound
    BaseRelationBindingUtil.reifiedArrows.delete(arrow.id);

    updateArrowTerminal({
      editor: this.editor,
      arrow,
      terminal: binding.props.terminal,
    });
  }

  override onBeforeDeleteToShape({
    binding,
  }: BindingOnShapeDeleteOptions<RelationBinding>): void {
    const arrow = this.editor.getShape<DiscourseRelationShape>(binding.fromId);
    // if toShape is deleted, delete the arrow
    // we don't want any unbound arrows hanging around
    if (arrow) {
      BaseRelationBindingUtil.reifiedArrows.delete(arrow.id);
      this.editor.deleteShape(arrow.id);
    }
  }

  /**
   * Check selected relation shapes for completed bindings
   * Called from mouseup event handler
   */
  static checkAndReifyRelation(editor: Editor): void {
    const selectedShapes = editor.getSelectedShapes();
    const relationShapes = selectedShapes.filter(
      (shape) => shape.type === "discourse-relation",
    ) as DiscourseRelationShape[];

    relationShapes.forEach((arrow) => {
      const bindings = getArrowBindings(editor, arrow);
      if (
        bindings.start &&
        bindings.end &&
        !BaseRelationBindingUtil.reifiedArrows.has(arrow.id)
      ) {
        BaseRelationBindingUtil.reifiedArrows.add(arrow.id);
        const util = editor.getShapeUtil(arrow);
        if (util instanceof DiscourseRelationUtil) {
          util.reifyRelationInFrontmatter(arrow, bindings).catch((error) => {
            console.error("Failed to reify relation in frontmatter:", error);
            // Remove from reified set on error so it can be retried
            BaseRelationBindingUtil.reifiedArrows.delete(arrow.id);
          });
        }
      }
    });
  }
}

// Obsidian uses a single relation shape type: 'discourse-relation'.
// Provide a binding util for that single type so bindings work for all relations.
export class DiscourseRelationBindingUtil extends BaseRelationBindingUtil {
  static override type = "discourse-relation" as const;
}

// eslint-disable-next-line preferArrows/prefer-arrow-functions
function arrowDidUpdate(editor: Editor, arrow: DiscourseRelationShape) {
  const bindings = getArrowBindings(editor, arrow);
  // if the shape is an arrow and its bound shape is on another page
  // or was deleted, unbind it
  for (const handle of ["start", "end"] as const) {
    const binding = bindings[handle];
    if (!binding) continue;
    const boundShape = editor.getShape(binding.toId);
    const isShapeInSamePageAsArrow =
      editor.getAncestorPageId(arrow) === editor.getAncestorPageId(boundShape);
    if (!boundShape || !isShapeInSamePageAsArrow) {
      // console.log("deleted arrow");
      // editor.deleteShape(arrow.id); // we don't want to keep the arrow
      updateArrowTerminal({ editor, arrow, terminal: handle, unbind: true });
    }
  }

  // always check the arrow parents
  reparentArrow(editor, arrow.id);
}

// eslint-disable-next-line preferArrows/prefer-arrow-functions
function reparentArrow(editor: Editor, arrowId: TLShapeId) {
  const arrow = editor.getShape<DiscourseRelationShape>(arrowId);
  if (!arrow) return;
  const bindings = getArrowBindings(editor, arrow);
  const { start, end } = bindings;
  const startShape = start ? editor.getShape(start.toId) : undefined;
  const endShape = end ? editor.getShape(end.toId) : undefined;

  const parentPageId = editor.getAncestorPageId(arrow);
  if (!parentPageId) return;

  let nextParentId: TLParentId;
  if (startShape && endShape) {
    // if arrow has two bindings, always parent arrow to closest common ancestor of the bindings
    nextParentId =
      editor.findCommonAncestor([startShape, endShape]) ?? parentPageId;
  } else if (startShape || endShape) {
    const bindingParentId = (startShape || endShape)?.parentId;
    // If the arrow and the shape that it is bound to have the same parent, then keep that parent
    if (bindingParentId && bindingParentId === arrow.parentId) {
      nextParentId = arrow.parentId;
    } else {
      // if arrow has one binding, keep arrow on its own page
      nextParentId = parentPageId;
    }
  } else {
    return;
  }

  if (nextParentId && nextParentId !== arrow.parentId) {
    editor.reparentShapes([arrowId], nextParentId);
  }

  const reparentedArrow = editor.getShape<DiscourseRelationShape>(arrowId);
  if (!reparentedArrow) throw Error("no reparented arrow");

  const startSibling = getShapeNearestSibling(
    editor,
    reparentedArrow,
    startShape,
  );
  const endSibling = getShapeNearestSibling(editor, reparentedArrow, endShape);

  let highestSibling: TLShape | undefined;

  if (startSibling && endSibling) {
    highestSibling =
      startSibling.index > endSibling.index ? startSibling : endSibling;
  } else if (startSibling && !endSibling) {
    highestSibling = startSibling;
  } else if (endSibling && !startSibling) {
    highestSibling = endSibling;
  } else {
    return;
  }

  let finalIndex: IndexKey;

  const higherSiblings = editor
    .getSortedChildIdsForParent(highestSibling.parentId)
    .map((id) => editor.getShape(id)!)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    .filter((sibling) => sibling.index > highestSibling!.index);

  if (higherSiblings.length) {
    // there are siblings above the highest bound sibling, we need to
    // insert between them.

    // if the next sibling is also a bound arrow though, we can end up
    // all fighting for the same indexes. so lets find the next
    // non-arrow sibling...
    const nextHighestNonArrowSibling = higherSiblings.find(
      (sibling) => sibling.type !== arrow.type,
    );

    if (
      // ...then, if we're above the last shape we want to be above...
      reparentedArrow.index > highestSibling.index &&
      // ...but below the next non-arrow sibling...
      (!nextHighestNonArrowSibling ||
        reparentedArrow.index < nextHighestNonArrowSibling.index)
    ) {
      // ...then we're already in the right place. no need to update!
      return;
    }

    // otherwise, we need to find the index between the highest sibling
    // we want to be above, and the next highest sibling we want to be
    // below:
    finalIndex = getIndexBetween(
      highestSibling.index,
      higherSiblings[0]?.index,
    );
  } else {
    // if there are no siblings above us, we can just get the next index:
    finalIndex = getIndexAbove(highestSibling.index);
  }

  if (finalIndex !== reparentedArrow.index) {
    editor.updateShapes<DiscourseRelationShape>([
      { id: arrowId, type: arrow.type, index: finalIndex },
    ]);
  }
}

// eslint-disable-next-line preferArrows/prefer-arrow-functions
function getShapeNearestSibling(
  editor: Editor,
  siblingShape: TLShape,
  targetShape: TLShape | undefined,
): TLShape | undefined {
  if (!targetShape) {
    return undefined;
  }
  if (targetShape.parentId === siblingShape.parentId) {
    return targetShape;
  }

  const ancestor = editor.findShapeAncestor(
    targetShape,
    (ancestor) => ancestor.parentId === siblingShape.parentId,
  );

  return ancestor;
}

// eslint-disable-next-line preferArrows/prefer-arrow-functions
export function updateArrowTerminal({
  editor,
  arrow,
  terminal,
  unbind = false,
  useHandle = false,
}: {
  editor: Editor;
  arrow: DiscourseRelationShape;
  terminal: "start" | "end";
  unbind?: boolean;
  useHandle?: boolean;
}) {
  const info = getArrowInfo(editor, arrow);
  if (!info) {
    throw new Error("expected arrow info");
  }

  const startPoint = useHandle ? info.start.handle : info.start.point;
  const endPoint = useHandle ? info.end.handle : info.end.point;
  const point = terminal === "start" ? startPoint : endPoint;

  const update = {
    id: arrow.id,
    type: arrow.type,
    props: { [terminal]: { x: point.x, y: point.y }, bend: arrow.props.bend },
  } satisfies TLShapePartial<DiscourseRelationShape>;

  // fix up the bend:
  if (!info.isStraight) {
    // find the new start/end points of the resulting arrow
    const newStart = terminal === "start" ? startPoint : info.start.handle;
    const newEnd = terminal === "end" ? endPoint : info.end.handle;
    const newMidPoint = Vec.Med(newStart, newEnd);

    // intersect a line segment perpendicular to the new arrow with the old arrow arc to
    // find the new mid-point
    const lineSegment = Vec.Sub(newStart, newEnd)
      .per()
      .uni()
      .mul(info.handleArc.radius * 2 * Math.sign(arrow.props.bend));

    // find the intersections with the old arrow arc:
    const intersections = intersectLineSegmentCircle(
      info.handleArc.center,
      Vec.Add(newMidPoint, lineSegment),
      info.handleArc.center,
      info.handleArc.radius,
    );

    assert(intersections?.length === 1);
    const bend =
      Vec.Dist(newMidPoint, intersections[0]!) * Math.sign(arrow.props.bend);
    // use `approximately` to avoid endless update loops
    if (!approximately(bend, update.props.bend)) {
      update.props.bend = bend;
    }
  }

  editor.updateShape(update);
  if (unbind) {
    removeArrowBinding(editor, arrow, terminal);
  }
}

// eslint-disable-next-line preferArrows/prefer-arrow-functions, max-params
function intersectLineSegmentCircle(
  a1: VecLike,
  a2: VecLike,
  c: VecLike,
  r: number,
) {
  const a = (a2.x - a1.x) * (a2.x - a1.x) + (a2.y - a1.y) * (a2.y - a1.y);
  const b = 2 * ((a2.x - a1.x) * (a1.x - c.x) + (a2.y - a1.y) * (a1.y - c.y));
  const cc =
    c.x * c.x +
    c.y * c.y +
    a1.x * a1.x +
    a1.y * a1.y -
    2 * (c.x * a1.x + c.y * a1.y) -
    r * r;
  const deter = b * b - 4 * a * cc;

  if (deter < 0) return null; // outside
  if (deter === 0) return null; // tangent

  const e = Math.sqrt(deter);
  const u1 = (-b + e) / (2 * a);
  const u2 = (-b - e) / (2 * a);

  if ((u1 < 0 || u1 > 1) && (u2 < 0 || u2 > 1)) {
    return null; // outside or inside
    // if ((u1 < 0 && u2 < 0) || (u1 > 1 && u2 > 1)) {
    // 	return null // outside
    // } else return null // inside'
  }

  const result: VecLike[] = [];

  if (0 <= u1 && u1 <= 1) result.push(Vec.Lrp(a1, a2, u1));
  if (0 <= u2 && u2 <= 1) result.push(Vec.Lrp(a1, a2, u2));

  if (result.length === 0) return null; // no intersection

  return result;
}