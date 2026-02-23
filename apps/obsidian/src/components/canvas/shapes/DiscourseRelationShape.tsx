/* Note: Lots of functions are copied and modified from tldraw Arrow shape 3.14.2
https://github.com/tldraw/tldraw/tree/main/packages/tldraw/src/lib/shapes/arrow
*/
import {
  ShapeUtil,
  TLBaseShape,
  arrowShapeProps,
  RecordPropsType,
  T,
  Geometry2d,
  Edge2d,
  Vec,
  Group2d,
  Rectangle2d,
  Arc2d,
  SVGContainer,
  TLShapeUtilCanBindOpts,
  TLHandle,
  TLArrowBindingProps,
  TLShapePartial,
  TLHandleDragInfo,
  Box,
  TLShapeUtilCanBeLaidOutOpts,
  WeakCache,
  TLResizeInfo,
  toDomPrecision,
  useIsEditing,
  getDefaultColorTheme,
  SvgExportContext,
  TLShapeUtilCanvasSvgDef,
  TEXT_PROPS,
  TextLabel,
} from "tldraw";
import { type App, type TFile } from "obsidian";
import DiscourseGraphPlugin from "~/index";
import {
  ARROW_HANDLES,
  ArrowheadCrossDef,
  ArrowheadDotDef,
  ArrowSvg,
  createOrUpdateArrowBinding,
  getArrowBindings,
  getArrowheadPathForType,
  getArrowInfo,
  getArrowLabelFontSize,
  getArrowLabelPosition,
  getArrowTerminalsInArrowSpace,
  getFillDefForCanvas,
  getFillDefForExport,
  getFontDefForExport,
  getSolidCurvedArrowPath,
  getSolidStraightArrowPath,
  mapObjectMapValues,
  removeArrowBinding,
  shapeAtTranslationStart,
  STROKE_SIZES,
  SvgTextLabel,
  updateArrowTerminal,
} from "~/components/canvas/utils/relationUtils";
import { RelationBindings } from "./DiscourseRelationBinding";
import { DiscourseNodeShape, DiscourseNodeUtil } from "./DiscourseNodeShape";
import { addRelationToRelationsJson } from "~/components/canvas/utils/relationJsonUtils";
import { showToast } from "~/components/canvas/utils/toastUtils";

export enum ArrowHandles {
  start = "start",
  middle = "middle",
  end = "end",
}

// Use arrow shape props directly
export type DiscourseRelationShapeProps = RecordPropsType<
  typeof arrowShapeProps
> & {
  relationTypeId: string;
};

export type DiscourseRelationShape = TLBaseShape<
  "discourse-relation",
  DiscourseRelationShapeProps
>;

export type DiscourseRelationUtilOptions = {
  app: App;
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
};

export class DiscourseRelationUtil extends ShapeUtil<DiscourseRelationShape> {
  static override type = "discourse-relation" as const;
  static props = {
    ...arrowShapeProps,
    relationTypeId: T.string,
  };

  declare options: DiscourseRelationUtilOptions;

  // Utility flags
  override canEdit = () => true;
  override canSnap = () => false;
  override hideResizeHandles = () => true;
  override hideRotateHandle = () => true;
  override hideSelectionBoundsBg = () => true;
  override hideSelectionBoundsFg = () => true;

  override canBind({
    toShapeType,
  }: TLShapeUtilCanBindOpts<DiscourseRelationShape>): boolean {
    return toShapeType === "discourse-node";
  }

  override canBeLaidOut(
    shape: DiscourseRelationShape,
    info: TLShapeUtilCanBeLaidOutOpts,
  ) {
    if (info.type === "flip") {
      // If we don't have this then the flip will be non-idempotent; that is, the flip will be multipotent, varipotent, or perhaps even omni-potent... and we can't have that
      const bindings = getArrowBindings(this.editor, shape);
      const { start, end } = bindings;
      const { shapes = [] } = info;
      if (start && !shapes.find((s) => s.id === start.toId)) return false;
      if (end && !shapes.find((s) => s.id === end.toId)) return false;
    }
    return true;
  }

  getDefaultProps(): DiscourseRelationShape["props"] {
    return {
      dash: "draw",
      size: "m",
      fill: "none",
      color: "black",
      labelColor: "black",
      bend: 0,
      start: { x: 0, y: 0 },
      end: { x: 100, y: 0 },
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
      text: "",
      labelPosition: 0.5,
      font: "draw",
      scale: 1,
      kind: "arc",
      elbowMidPoint: 0,
      relationTypeId: "",
    };
  }

  getGeometry(shape: DiscourseRelationShape): Geometry2d {
    const info = getArrowInfo(this.editor, shape)!;

    const debugGeom: Geometry2d[] = [];

    const bodyGeom = info.isStraight
      ? new Edge2d({
          start: Vec.From(info.start.point),
          end: Vec.From(info.end.point),
        })
      : new Arc2d({
          center: Vec.From(info.bodyArc.center),
          start: Vec.From(info.start.point),
          end: Vec.From(info.end.point),
          sweepFlag: info.bodyArc.sweepFlag,
          largeArcFlag: info.bodyArc.largeArcFlag,
        });

    let labelGeom;
    if (shape.props.text.trim()) {
      const labelPosition = getArrowLabelPosition(this.editor, shape);
      debugGeom.push(...labelPosition.debugGeom);
      labelGeom = new Rectangle2d({
        x: labelPosition.box.x,
        y: labelPosition.box.y,
        width: labelPosition.box.w,
        height: labelPosition.box.h,
        isFilled: true,
        isLabel: true,
      });
    }

    return new Group2d({
      children: [
        ...(labelGeom ? [bodyGeom, labelGeom] : [bodyGeom]),
        ...debugGeom,
      ],
    });
  }

  override onHandleDrag(
    shape: DiscourseRelationShape,
    info: TLHandleDragInfo<DiscourseRelationShape>,
  ) {
    const handleId = info.handle.id as ArrowHandles;
    const bindings = getArrowBindings(this.editor, shape);

    if (handleId === ArrowHandles.middle) {
      // Bending the arrow...
      const { start, end } = getArrowTerminalsInArrowSpace(
        this.editor,
        shape,
        bindings,
      );

      const delta = Vec.Sub(end, start);
      const v = Vec.Per(delta);

      const med = Vec.Med(end, start);
      const A = Vec.Sub(med, v);
      const B = Vec.Add(med, v);

      const point = Vec.NearestPointOnLineSegment(A, B, info.handle, false);
      let bend = Vec.Dist(point, med);
      if (Vec.Clockwise(point, end, med)) bend *= -1;
      return { id: shape.id, type: shape.type, props: { bend } };
    }

    // Start or end, pointing the arrow...

    const update: TLShapePartial<DiscourseRelationShape> = {
      id: shape.id,
      type: shape.type,
      props: {},
    };

    const currentBinding = bindings[handleId];

    const otherHandleId =
      handleId === ArrowHandles.start ? ArrowHandles.end : ArrowHandles.start;
    const otherBinding = bindings[otherHandleId];

    if (this.editor.inputs.ctrlKey) {
      // todo: maybe double check that this isn't equal to the other handle too?
      // Skip binding
      removeArrowBinding(this.editor, shape, handleId);

      update.props![handleId] = { x: info.handle.x, y: info.handle.y };
      return update;
    }

    const point = this.editor
      .getShapePageTransform(shape.id)
      .applyToPoint(info.handle);

    const target = this.editor.getShapeAtPoint(point, {
      hitInside: true,
      hitFrameInside: true,
      margin: 0,
      filter: (targetShape) => {
        return (
          !targetShape.isLocked &&
          this.editor.canBindShapes({
            fromShape: shape,
            toShape: targetShape,
            binding: shape.type,
          })
        );
      },
    });

    if (
      !target ||
      // TODO - this is a hack/fix
      // the shape is targeting itself on initial drag
      // find out why
      target.id === shape.id
    ) {
      // TODO re-implement this on pointer up
      // if (
      //   currentBinding &&
      //   otherBinding &&
      //   currentBinding.toId !== otherBinding.toId
      // ) {
      //   this.cancelAndWarn("Cannot remove handle.");
      //   return update;
      // }

      // todo: maybe double check that this isn't equal to the other handle too?
      removeArrowBinding(this.editor, shape, handleId);
      update.props![handleId] = { x: info.handle.x, y: info.handle.y };
      return update;
    }

    // we've got a target! the handle is being dragged over a shape, bind to it

    const targetGeometry = this.editor.getShapeGeometry(target);
    const targetBounds = Box.ZeroFix(targetGeometry.bounds);
    const pageTransform = this.editor.getShapePageTransform(update.id);
    const pointInPageSpace = pageTransform.applyToPoint(info.handle);
    const pointInTargetSpace = this.editor.getPointInShapeSpace(
      target,
      pointInPageSpace,
    );

    let precise = info.isPrecise;

    if (!precise) {
      // If we're switching to a new bound shape, then precise only if moving slowly
      if (
        !currentBinding ||
        (currentBinding && target.id !== currentBinding.toId)
      ) {
        precise = this.editor.inputs.pointerVelocity.len() < 0.5;
      }
    }

    if (!precise) {
      if (!targetGeometry.isClosed) {
        precise = true;
      }

      // Double check that we're not going to be doing an imprecise snap on
      // the same shape twice, as this would result in a zero length line
      if (
        otherBinding &&
        target.id === otherBinding.toId &&
        otherBinding.props.isPrecise
      ) {
        precise = true;
      }
    }

    const normalizedAnchor = {
      x: (pointInTargetSpace.x - targetBounds.minX) / targetBounds.width,
      y: (pointInTargetSpace.y - targetBounds.minY) / targetBounds.height,
    };

    if (precise) {
      // Turn off precision if we're within a certain distance to the center of the shape.
      // Funky math but we want the snap distance to be 4 at the minimum and either
      // 16 or 15% of the smaller dimension of the target shape, whichever is smaller
      if (
        Vec.Dist(pointInTargetSpace, targetBounds.center) <
        Math.max(
          4,
          Math.min(
            Math.min(targetBounds.width, targetBounds.height) * 0.15,
            16,
          ),
        ) /
          this.editor.getZoomLevel()
      ) {
        normalizedAnchor.x = 0.5;
        normalizedAnchor.y = 0.5;
      }
    }

    // Validate target node type compatibility before creating binding
    // Only validate when we're actually connecting to a different target node
    if (
      target.type === "discourse-node" &&
      otherBinding &&
      target.id !== otherBinding.toId && // Only validate when connecting to a different node
      (!currentBinding || target.id !== currentBinding.toId) // Only validate when changing targets
    ) {
      const sourceNodeId = otherBinding.toId;
      const sourceNode = this.editor.getShape(sourceNodeId);
      const targetNodeTypeId = (target as { props?: { nodeTypeId?: string } })
        .props?.nodeTypeId;
      const sourceNodeTypeId = (
        sourceNode as { props?: { nodeTypeId?: string } } | null
      )?.props?.nodeTypeId;

      if (sourceNodeTypeId && targetNodeTypeId && shape.props.relationTypeId) {
        const isValidConnection = this.isValidNodeConnection(
          sourceNodeTypeId,
          targetNodeTypeId,
          shape.props.relationTypeId,
        );

        if (!isValidConnection) {
          const sourceNodeType = this.options.plugin.settings.nodeTypes.find(
            (nt) => nt.id === sourceNodeTypeId,
          );
          const targetNodeType = this.options.plugin.settings.nodeTypes.find(
            (nt) => nt.id === targetNodeTypeId,
          );
          const relationType = this.options.plugin.settings.relationTypes.find(
            (rt) => rt.id === shape.props.relationTypeId,
          );

          // Show error toast and delete the entire relation shape
          const errorMessage = `Cannot connect "${sourceNodeType?.name}" to "${targetNodeType?.name}" with "${relationType?.label}" relation`;
          showToast({
            severity: "error",
            title: "Invalid Connection",
            description: errorMessage,
          });

          // Remove binding and return without creating connection
          removeArrowBinding(this.editor, shape, handleId);
          update.props![handleId] = { x: info.handle.x, y: info.handle.y };
          this.editor.deleteShapes([shape.id]);
          return update;
        }
      }
    }

    const b: TLArrowBindingProps = {
      terminal: handleId,
      normalizedAnchor,
      isPrecise: precise,
      isExact: this.editor.inputs.altKey,
      snap: "none",
    };

    createOrUpdateArrowBinding(this.editor, shape, target.id, b);

    this.editor.setHintingShapes([target.id]);

    const newBindings = getArrowBindings(this.editor, shape);

    // Check if both ends are bound and update text based on direction
    if (newBindings.start && newBindings.end) {
      this.updateRelationTextForDirection(shape, newBindings);
    }
    if (
      newBindings.start &&
      newBindings.end &&
      newBindings.start.toId === newBindings.end.toId
    ) {
      if (
        Vec.Equals(
          newBindings.start.props.normalizedAnchor,
          newBindings.end.props.normalizedAnchor,
        )
      ) {
        createOrUpdateArrowBinding(this.editor, shape, newBindings.end.toId, {
          ...newBindings.end.props,
          normalizedAnchor: {
            x: newBindings.end.props.normalizedAnchor.x + 0.05,
            y: newBindings.end.props.normalizedAnchor.y,
          },
        });
      }
    }

    return update;
  }

  override getHandles(shape: DiscourseRelationShape): TLHandle[] {
    const info = getArrowInfo(this.editor, shape)!;

    return [
      {
        id: ARROW_HANDLES.START,
        type: "vertex",
        index: "a0",
        x: info.start.handle.x,
        y: info.start.handle.y,
      },
      {
        id: ARROW_HANDLES.MIDDLE,
        type: "virtual",
        index: "a2",
        x: info.middle.x,
        y: info.middle.y,
      },
      {
        id: ARROW_HANDLES.END,
        type: "vertex",
        index: "a3",
        x: info.end.handle.x,
        y: info.end.handle.y,
      },
    ].filter(Boolean) as TLHandle[];
  }

  override onTranslate(
    initialShape: DiscourseRelationShape,
    shape: DiscourseRelationShape,
  ) {
    const atTranslationStart = shapeAtTranslationStart.get(initialShape);
    if (!atTranslationStart) return;

    const bindings = getArrowBindings(this.editor, shape);

    // Check if other shapes are also being translated
    const selectedShapeIds = this.editor.getSelectedShapeIds();
    const onlyRelationSelected = selectedShapeIds.length === 1 && selectedShapeIds[0] === shape.id;

    // If both ends are bound AND only the relation is selected, convert translation to bend changes
    // If other shapes are also selected, do a simple translation instead
    if (bindings.start && bindings.end && onlyRelationSelected) {
      const shapePageTransform = this.editor.getShapePageTransform(shape.id);
      const pageDelta = Vec.Sub(
        shapePageTransform.applyToPoint(shape),
        atTranslationStart.pagePosition,
      );

      const initialBindings = getArrowBindings(this.editor, initialShape);
      const { start: initialStart, end: initialEnd } =
        getArrowTerminalsInArrowSpace(
          this.editor,
          initialShape,
          initialBindings,
        );

      const delta = Vec.Sub(initialEnd, initialStart);
      const v = Vec.Per(delta);
      const med = Vec.Med(initialEnd, initialStart);

      const initialPageTransform = this.editor.getShapePageTransform(
        initialShape.id,
      );
      const arrowSpaceDelta = Vec.Rot(
        pageDelta,
        -initialPageTransform.rotation(),
      );

      const translatedMidpoint = Vec.Add(med, arrowSpaceDelta);
      const A = Vec.Sub(med, v);
      const B = Vec.Add(med, v);
      const point = Vec.NearestPointOnLineSegment(
        A,
        B,
        translatedMidpoint,
        false,
      );

      // Calculate new bend based on distance from midpoint
      let newBend = Vec.Dist(point, med);
      if (Vec.Clockwise(point, initialEnd, med)) {
        newBend *= -1;
      }

      return {
        id: shape.id,
        type: shape.type,
        x: initialShape.x,
        y: initialShape.y,
        props: { bend: newBend },
      };
    }

    // If not both ends are bound, use normal translation behavior
    const shapePageTransform = this.editor.getShapePageTransform(shape.id);
    const pageDelta = Vec.Sub(
      shapePageTransform.applyToPoint(shape),
      atTranslationStart.pagePosition,
    );

    for (const terminalBinding of Object.values(
      atTranslationStart.terminalBindings,
    )) {
      if (!terminalBinding) continue;

      const newPagePoint = Vec.Add(
        terminalBinding.pagePosition,
        Vec.Mul(pageDelta, 0.5),
      );
      const newTarget = this.editor.getShapeAtPoint(newPagePoint, {
        hitInside: true,
        hitFrameInside: true,
        margin: 0,
        filter: (targetShape) => {
          return (
            !targetShape.isLocked &&
            this.editor.canBindShapes({
              fromShape: shape,
              toShape: targetShape,
              binding: shape.type,
            })
          );
        },
      });

      if (newTarget?.id === terminalBinding.binding.toId) {
        const targetBounds = Box.ZeroFix(
          this.editor.getShapeGeometry(newTarget).bounds,
        );
        const pointInTargetSpace = this.editor.getPointInShapeSpace(
          newTarget,
          newPagePoint,
        );
        const normalizedAnchor = {
          x: (pointInTargetSpace.x - targetBounds.minX) / targetBounds.width,
          y: (pointInTargetSpace.y - targetBounds.minY) / targetBounds.height,
        };
        createOrUpdateArrowBinding(this.editor, shape, newTarget.id, {
          ...terminalBinding.binding.props,
          normalizedAnchor,
          isPrecise: true,
        });
      } else {
        removeArrowBinding(
          this.editor,
          shape,
          terminalBinding.binding.props.terminal,
        );
      }
    }
  }

  override onTranslateStart(shape: DiscourseRelationShape) {
    const bindings = getArrowBindings(this.editor, shape);

    const terminalsInArrowSpace = getArrowTerminalsInArrowSpace(
      this.editor,
      shape,
      bindings,
    );
    const shapePageTransform = this.editor.getShapePageTransform(shape.id);

    // If both ends are bound, we'll convert translation to bend changes
    // So we don't need to update bindings or unbind
    if (bindings.start && bindings.end) {
      shapeAtTranslationStart.set(shape, {
        pagePosition: shapePageTransform.applyToPoint(shape),
        terminalBindings: mapObjectMapValues(
          terminalsInArrowSpace,
          (terminalName, point) => {
            const binding = bindings[terminalName];
            if (!binding) return null;
            return {
              binding,
              shapePosition: point,
              pagePosition: shapePageTransform.applyToPoint(point),
            };
          },
        ),
      });
      return;
    }

    // If at least one bound shape is in the selection, do nothing;
    // If no bound shapes are in the selection, unbind any bound shapes

    const selectedShapeIds = this.editor.getSelectedShapeIds();

    if (
      (bindings.start &&
        (selectedShapeIds.includes(bindings.start.toId) ||
          this.editor.isAncestorSelected(bindings.start.toId))) ||
      (bindings.end &&
        (selectedShapeIds.includes(bindings.end.toId) ||
          this.editor.isAncestorSelected(bindings.end.toId)))
    ) {
      return;
    }

    // When we start translating shapes, record where their bindings were in page space so we
    // can maintain them as we translate the arrow
    shapeAtTranslationStart.set(shape, {
      pagePosition: shapePageTransform.applyToPoint(shape),
      terminalBindings: mapObjectMapValues(
        terminalsInArrowSpace,
        (terminalName, point) => {
          const binding = bindings[terminalName];
          if (!binding) return null;
          return {
            binding,
            shapePosition: point,
            pagePosition: shapePageTransform.applyToPoint(point),
          };
        },
      ),
    });

    // update arrow terminal bindings eagerly to make sure the arrows unbind nicely when translating
    if (bindings.start) {
      updateArrowTerminal({
        editor: this.editor,
        relation: shape,
        terminal: "start",
        useHandle: true,
      });
      shape = this.editor.getShape(shape.id) as DiscourseRelationShape;
    }
    if (bindings.end) {
      updateArrowTerminal({
        editor: this.editor,
        relation: shape,
        terminal: "end",
        useHandle: true,
      });
    }

    for (const handleName of [
      ARROW_HANDLES.START,
      ARROW_HANDLES.END,
    ] as const) {
      const binding = bindings[handleName];
      if (!binding) continue;

      this.editor.updateBinding({
        ...binding,
        props: { ...binding.props, isPrecise: true },
      });
    }

    return;
  }

  readonly resizeInitialBindings = new WeakCache<
    DiscourseRelationShape,
    RelationBindings
  >();

  override onResize(
    shape: DiscourseRelationShape,
    info: TLResizeInfo<DiscourseRelationShape>,
  ) {
    const { scaleX, scaleY } = info;

    const bindings = this.resizeInitialBindings.get(shape, () =>
      getArrowBindings(this.editor, shape),
    );
    const terminals = getArrowTerminalsInArrowSpace(
      this.editor,
      shape,
      bindings,
    );

    const { start, end } = structuredClone<DiscourseRelationShape["props"]>(
      shape.props,
    );
    let { bend } = shape.props;

    // Rescale start handle if it's not bound to a shape
    if (!bindings.start) {
      start.x = terminals.start.x * scaleX;
      start.y = terminals.start.y * scaleY;
    }

    // Rescale end handle if it's not bound to a shape
    if (!bindings.end) {
      end.x = terminals.end.x * scaleX;
      end.y = terminals.end.y * scaleY;
    }

    // todo: we should only change the normalized anchor positions
    // of the shape's handles if the bound shape is also being resized

    const mx = Math.abs(scaleX);
    const my = Math.abs(scaleY);

    const startNormalizedAnchor = bindings?.start
      ? Vec.From(bindings.start.props.normalizedAnchor)
      : null;
    const endNormalizedAnchor = bindings?.end
      ? Vec.From(bindings.end.props.normalizedAnchor)
      : null;

    if (scaleX < 0 && scaleY >= 0) {
      if (bend !== 0) {
        bend *= -1;
        bend *= Math.max(mx, my);
      }

      if (startNormalizedAnchor) {
        startNormalizedAnchor.x = 1 - startNormalizedAnchor.x;
      }

      if (endNormalizedAnchor) {
        endNormalizedAnchor.x = 1 - endNormalizedAnchor.x;
      }
    } else if (scaleX >= 0 && scaleY < 0) {
      if (bend !== 0) {
        bend *= -1;
        bend *= Math.max(mx, my);
      }

      if (startNormalizedAnchor) {
        startNormalizedAnchor.y = 1 - startNormalizedAnchor.y;
      }

      if (endNormalizedAnchor) {
        endNormalizedAnchor.y = 1 - endNormalizedAnchor.y;
      }
    } else if (scaleX >= 0 && scaleY >= 0) {
      if (bend !== 0) {
        bend *= Math.max(mx, my);
      }
    } else if (scaleX < 0 && scaleY < 0) {
      if (bend !== 0) {
        bend *= Math.max(mx, my);
      }

      if (startNormalizedAnchor) {
        startNormalizedAnchor.x = 1 - startNormalizedAnchor.x;
        startNormalizedAnchor.y = 1 - startNormalizedAnchor.y;
      }

      if (endNormalizedAnchor) {
        endNormalizedAnchor.x = 1 - endNormalizedAnchor.x;
        endNormalizedAnchor.y = 1 - endNormalizedAnchor.y;
      }
    }

    if (bindings.start && startNormalizedAnchor) {
      createOrUpdateArrowBinding(this.editor, shape, bindings.start.toId, {
        ...bindings.start.props,
        normalizedAnchor: startNormalizedAnchor.toJson(),
      });
    }
    if (bindings.end && endNormalizedAnchor) {
      createOrUpdateArrowBinding(this.editor, shape, bindings.end.toId, {
        ...bindings.end.props,
        normalizedAnchor: endNormalizedAnchor.toJson(),
      });
    }

    const next = { props: { start, end, bend } };

    return next;
  }

  override onDoubleClickHandle(
    shape: DiscourseRelationShape,
    handle: TLHandle,
  ): TLShapePartial<DiscourseRelationShape> | void {
    switch (handle.id as ARROW_HANDLES) {
      case ARROW_HANDLES.START: {
        return {
          id: shape.id,
          type: shape.type,
          props: {
            ...shape.props,
            arrowheadStart:
              shape.props.arrowheadStart === "none" ? "arrow" : "none",
          },
        };
      }
      case ARROW_HANDLES.END: {
        return {
          id: shape.id,
          type: shape.type,
          props: {
            ...shape.props,
            arrowheadEnd:
              shape.props.arrowheadEnd === "none" ? "arrow" : "none",
          },
        };
      }
    }
  }

  component(shape: DiscourseRelationShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    // const theme = useDefaultColorTheme();
    const onlySelectedShape = this.editor.getOnlySelectedShape();
    const shouldDisplayHandles =
      this.editor.isInAny(
        "select.idle",
        "select.pointing_handle",
        "select.dragging_handle",
        "select.translating",
        "arrow.dragging",
      ) && !this.editor.getInstanceState().isReadonly;

    const info = getArrowInfo(this.editor, shape);
    if (!info?.isValid) return null;

    const labelPosition = getArrowLabelPosition(this.editor, shape);
    const isSelected = shape.id === this.editor.getOnlySelectedShapeId();
    const isEditing = this.editor.getEditingShapeId() === shape.id;
    const showArrowLabel = isEditing || shape.props.text;

    return (
      <>
        <SVGContainer id={shape.id} style={{ minWidth: 50, minHeight: 50 }}>
          <ArrowSvg
            shape={shape}
            shouldDisplayHandles={
              shouldDisplayHandles && onlySelectedShape?.id === shape.id
            }
            // color={shape.props.color}
          />
        </SVGContainer>
        {showArrowLabel && (
          <TextLabel
            shapeId={shape.id}
            classNamePrefix="tl-arrow"
            type={shape.type}
            font={shape.props.font}
            fontSize={getArrowLabelFontSize(shape)}
            lineHeight={TEXT_PROPS.lineHeight}
            align="middle"
            verticalAlign="middle"
            text={shape.props.text}
            labelColor={shape.props.labelColor}
            textWidth={labelPosition.box.w}
            isSelected={isSelected}
            padding={0}
            style={{
              transform: `translate(${labelPosition.box.center.x}px, ${labelPosition.box.center.y}px)`,
              // transform: `translate(${100}px, ${100}px)`,
            }}
          />
        )}
      </>
    );
  }

  indicator(shape: DiscourseRelationShape) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isEditing = useIsEditing(shape.id);

    const info = getArrowInfo(this.editor, shape);
    if (!info) return null;

    const { start, end } = getArrowTerminalsInArrowSpace(
      this.editor,
      shape,
      info?.bindings,
    );
    const geometry = this.editor.getShapeGeometry<Group2d>(shape);
    const bounds = geometry.bounds;

    const labelGeometry = shape.props.text.trim()
      ? (geometry.children[1] as Rectangle2d)
      : null;

    if (Vec.Equals(start, end)) return null;

    const strokeWidth = STROKE_SIZES[shape.props.size] * shape.props.scale;

    const as =
      info.start.arrowhead &&
      getArrowheadPathForType(info, "start", strokeWidth);
    const ae =
      info.end.arrowhead && getArrowheadPathForType(info, "end", strokeWidth);

    const path = info.isStraight
      ? getSolidStraightArrowPath(info)
      : getSolidCurvedArrowPath(info);

    const includeMask =
      (as && info.start.arrowhead !== "arrow") ||
      (ae && info.end.arrowhead !== "arrow") ||
      !!labelGeometry;

    const maskId = (shape.id + "_clip").replace(":", "_");
    const labelBounds = labelGeometry
      ? labelGeometry.getBounds()
      : new Box(0, 0, 0, 0);
    if (isEditing && labelGeometry) {
      return (
        <rect
          x={toDomPrecision(labelBounds.x)}
          y={toDomPrecision(labelBounds.y)}
          width={labelBounds.w}
          height={labelBounds.h}
          rx={3.5 * shape.props.scale}
          ry={3.5 * shape.props.scale}
        />
      );
    }

    return (
      <g>
        {includeMask && (
          <defs>
            <mask id={maskId}>
              <rect
                x={bounds.minX - 100}
                y={bounds.minY - 100}
                width={bounds.w + 200}
                height={bounds.h + 200}
                fill="white"
              />
              {labelGeometry && (
                <rect
                  x={toDomPrecision(labelBounds.x)}
                  y={toDomPrecision(labelBounds.y)}
                  width={labelBounds.w}
                  height={labelBounds.h}
                  fill="black"
                  rx={3.5 * shape.props.scale}
                  ry={3.5 * shape.props.scale}
                />
              )}
              {as && (
                <path
                  d={as}
                  fill={info.start.arrowhead === "arrow" ? "none" : "black"}
                  stroke="none"
                />
              )}
              {ae && (
                <path
                  d={ae}
                  fill={info.end.arrowhead === "arrow" ? "none" : "black"}
                  stroke="none"
                />
              )}
            </mask>
          </defs>
        )}
        {/* firefox will clip if you provide a maskURL even if there is no mask matching that URL in the DOM */}
        <g {...(includeMask ? { mask: `url(#${maskId})` } : undefined)}>
          {/* This rect needs to be here if we're creating a mask due to an svg quirk on Chrome */}
          {includeMask && (
            <rect
              x={bounds.minX - 100}
              y={bounds.minY - 100}
              width={bounds.width + 200}
              height={bounds.height + 200}
              opacity={0}
            />
          )}

          <path d={path} />
        </g>
        {as && <path d={as} />}
        {ae && <path d={ae} />}
        {labelGeometry && (
          <rect
            x={toDomPrecision(labelBounds.x)}
            y={toDomPrecision(labelBounds.y)}
            width={labelBounds.w}
            height={labelBounds.h}
            rx={3.5}
            ry={3.5}
          />
        )}
      </g>
    );
  }

  override onEditEnd(shape: DiscourseRelationShape) {
    const {
      id,
      type,
      props: { text },
    } = shape;
    if (text.trimEnd() !== shape.props.text) {
      this.editor.updateShapes<DiscourseRelationShape>([
        { id, type, props: { text: text.trimEnd() } },
      ]);
    }
  }

  override toSvg(shape: DiscourseRelationShape, ctx: SvgExportContext) {
    ctx.addExportDef(getFillDefForExport(shape.props.fill));
    if (shape.props.text)
      ctx.addExportDef(getFontDefForExport(shape.props.font));
    const theme = getDefaultColorTheme(ctx);
    const scaleFactor = 1 / shape.props.scale;

    return (
      <g transform={`scale(${scaleFactor})`}>
        <ArrowSvg
          shape={shape}
          shouldDisplayHandles={false}
          // color={shape.props.color}
        />
        <SvgTextLabel
          fontSize={getArrowLabelFontSize(shape)}
          font={shape.props.font}
          align="middle"
          verticalAlign="middle"
          text={shape.props.text}
          labelColor={theme[shape.props.labelColor].solid}
          bounds={getArrowLabelPosition(this.editor, shape).box}
          padding={4 * shape.props.scale}
        />
      </g>
    );
  }

  override getCanvasSvgDefs(): TLShapeUtilCanvasSvgDef[] {
    return [
      getFillDefForCanvas(),
      { key: `arrow:dot`, component: ArrowheadDotDef },
      { key: `arrow:cross`, component: ArrowheadCrossDef },
    ];
  }

  /**
   * Updates the relation text based on the direction of the connection.
   * If the relation is pointing in the reverse direction, shows the complement.
   */
  updateRelationTextForDirection(
    shape: DiscourseRelationShape,
    bindings: RelationBindings,
  ): void {
    const plugin = this.options.plugin;
    const relationTypeId = shape.props.relationTypeId;

    if (!relationTypeId || !bindings.start || !bindings.end) return;

    const startNode = this.editor.getShape(bindings.start.toId);
    const endNode = this.editor.getShape(bindings.end.toId);

    if (!startNode || !endNode) return;

    const startNodeTypeId = (startNode as { props?: { nodeTypeId?: string } })
      ?.props?.nodeTypeId;
    const endNodeTypeId = (endNode as { props?: { nodeTypeId?: string } })
      ?.props?.nodeTypeId;

    if (!startNodeTypeId || !endNodeTypeId) return;

    const relationType = plugin.settings.relationTypes.find(
      (rt) => rt.id === relationTypeId,
    );

    if (!relationType) return;

    // Check if this is a direct connection (start -> end)
    const isDirectConnection = plugin.settings.discourseRelations.some(
      (relation) =>
        relation.relationshipTypeId === relationTypeId &&
        relation.sourceId === startNodeTypeId &&
        relation.destinationId === endNodeTypeId,
    );

    // Check if this is a reverse connection (end -> start, so we need complement)
    const isReverseConnection = plugin.settings.discourseRelations.some(
      (relation) =>
        relation.relationshipTypeId === relationTypeId &&
        relation.sourceId === endNodeTypeId &&
        relation.destinationId === startNodeTypeId,
    );

    let newText = relationType.label; // Default to main label

    if (isReverseConnection && !isDirectConnection) {
      // This is purely a reverse connection, use complement
      newText = relationType.complement;
    }

    // Update the shape text if it's different
    if (shape.props.text !== newText) {
      this.editor.updateShapes([
        {
          id: shape.id,
          type: shape.type,
          props: { text: newText },
        },
      ]);
    }
  }

  /**
   * Validates if a connection between source and target node types is allowed
   * for the given relation type, checking both directions of the relation.
   */
  isValidNodeConnection(
    sourceNodeTypeId: string,
    targetNodeTypeId: string,
    relationTypeId: string,
  ): boolean {
    const plugin = this.options.plugin;

    // Check direct connection (source -> target)
    const directConnection = plugin.settings.discourseRelations.some(
      (relation) =>
        relation.relationshipTypeId === relationTypeId &&
        relation.sourceId === sourceNodeTypeId &&
        relation.destinationId === targetNodeTypeId,
    );

    if (directConnection) return true;

    // Check reverse connection (target -> source)
    // This handles bidirectional relations where the complement is used
    const reverseConnection = plugin.settings.discourseRelations.some(
      (relation) =>
        relation.relationshipTypeId === relationTypeId &&
        relation.sourceId === targetNodeTypeId &&
        relation.destinationId === sourceNodeTypeId,
    );

    return reverseConnection;
  }

  /**
   * Reifies the relation in the frontmatter of both connected files.
   * This creates the bidirectional links that make the relation persistent.
   */
  async reifyRelationInFrontmatter(
    shape: DiscourseRelationShape,
    bindings: RelationBindings,
  ): Promise<void> {
    if (!bindings.start || !bindings.end || !shape.props.relationTypeId) {
      return;
    }

    try {
      const startNode = this.editor.getShape(bindings.start.toId);
      const endNode = this.editor.getShape(bindings.end.toId);

      if (
        !startNode ||
        !endNode ||
        startNode.type !== "discourse-node" ||
        endNode.type !== "discourse-node"
      ) {
        return;
      }

      const startNodeUtil = this.editor.getShapeUtil(startNode);
      const endNodeUtil = this.editor.getShapeUtil(endNode);

      // Get the files associated with both nodes
      const sourceFile = await (startNodeUtil as DiscourseNodeUtil).getFile(
        startNode as DiscourseNodeShape,
        {
          app: this.options.app,
          canvasFile: this.options.canvasFile,
        },
      );
      const targetFile = await (endNodeUtil as DiscourseNodeUtil).getFile(
        endNode as DiscourseNodeShape,
        {
          app: this.options.app,
          canvasFile: this.options.canvasFile,
        },
      );

      if (!sourceFile || !targetFile) {
        console.warn("Could not resolve files for relation nodes");
        return;
      }

      const { alreadyExisted, relationInstanceId } =
        await addRelationToRelationsJson({
          plugin: this.options.plugin,
          sourceFile,
          targetFile,
          relationTypeId: shape.props.relationTypeId,
        });

      if (relationInstanceId) {
        this.editor.updateShape({
          id: shape.id,
          type: shape.type,
          meta: { ...shape.meta, relationInstanceId },
        });
      }

      const relationType = this.options.plugin.settings.relationTypes.find(
        (rt) => rt.id === shape.props.relationTypeId,
      );

      if (relationType && !alreadyExisted) {
        showToast({
          severity: "success",
          title: "Relation Created",
          description: `Added ${relationType.label} relation between ${sourceFile.basename} and ${targetFile.basename}`,
        });
      }
    } catch (error) {
      console.error("Failed to reify relation in frontmatter:", error);
      showToast({
        severity: "error",
        title: "Failed to Save Relation",
        description: "Could not save relation to files",
      });
    }
  }
}

export const createDiscourseRelationUtil = (
  options: DiscourseRelationUtilOptions,
) => {
  const configuredUtil = class extends DiscourseRelationUtil {
    options = options;
  };
  return configuredUtil;
};
