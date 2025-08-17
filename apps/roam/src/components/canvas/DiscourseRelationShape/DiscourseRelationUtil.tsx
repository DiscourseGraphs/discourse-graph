import React from "react";
import {
  RecordPropsType,
  arrowShapeProps,
  TLBaseShape,
  ShapeUtil,
  TLShapeUtilCanBindOpts,
  TLShapeUtilFlag,
  Geometry2d,
  Edge2d,
  Vec,
  Group2d,
  TLHandle,
  useDefaultColorTheme,
  SVGContainer,
  TextLabel,
  TEXT_PROPS,
  TLOnEditEndHandler,
  Box,
  toDomPrecision,
  Arc2d,
  useIsEditing,
  Rectangle2d,
  SvgExportContext,
  getDefaultColorTheme,
  TLShapeUtilCanvasSvgDef,
  TLShapePartial,
  TLOnHandleDragHandler,
  TLOnResizeHandler,
  TLOnTranslateHandler,
  TLOnTranslateStartHandler,
  WeakCache,
  textShapeProps,
  TLShapeId,
  TLShapeUtilConstructor,
} from "tldraw";
import { RelationBindings } from "./DiscourseRelationBindings";
import {
  ARROW_HANDLES,
  ArrowSvg,
  ArrowheadCrossDef,
  ArrowheadDotDef,
  STROKE_SIZES,
  SvgTextLabel,
  createOrUpdateArrowBinding,
  getArrowBindings,
  getArrowInfo,
  getArrowLabelFontSize,
  getArrowLabelPosition,
  getArrowTerminalsInArrowSpace,
  getArrowheadPathForType,
  getFillDefForCanvas,
  getFillDefForExport,
  getFontDefForExport,
  getSolidCurvedArrowPath,
  getSolidStraightArrowPath,
  mapObjectMapValues,
  removeArrowBinding,
  shapeAtTranslationStart,
  updateArrowTerminal,
} from "./helpers";
import { discourseContext, isPageUid } from "~/components/canvas/Tldraw";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { InputTextNode } from "roamjs-components/types";
import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import triplesToBlocks from "~/utils/triplesToBlocks";
import {
  BaseDiscourseNodeUtil,
  DiscourseNodeShape,
} from "~/components/canvas/DiscourseNodeUtil";
import getCurrentPageUid from "roamjs-components/dom/getCurrentPageUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import { AddReferencedNodeType } from "./DiscourseRelationTool";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";

const COLOR_ARRAY = Array.from(Object.values(textShapeProps.color)).reverse();

export const createAllReferencedNodeUtils = (
  allAddReferencedNodeByAction: AddReferencedNodeType,
): TLShapeUtilConstructor<DiscourseRelationShape>[] => {
  return Object.keys(allAddReferencedNodeByAction).map((action) => {
    class ReferencedNodeUtil extends BaseDiscourseRelationUtil {
      static override type = action;

      isDiscourseNodeShape(shape: any): shape is DiscourseNodeShape {
        const shapeUtil = this.editor.getShapeUtil(shape.type);
        return shapeUtil instanceof BaseDiscourseNodeUtil;
      }

      handleCreateRelationsInRoam = async ({
        arrow,
        targetId,
      }: {
        arrow: DiscourseRelationShape;
        targetId: TLShapeId;
      }) => {
        const editor = this.editor;
        const deleteAndWarn = (title: string) => {
          dispatchToastEvent({
            id: `tldraw-cancel-and-warn-${title}`,
            title,
            severity: "warning",
          });
          this.editor.deleteShapes([arrow.id]);
        };

        const target = editor.getShape(targetId);
        const bindings = editor.getBindingsFromShape(arrow, arrow.type);
        const sourceId = bindings.find((b) => b.toId !== targetId)?.toId;
        if (!sourceId) return;
        const source = editor.getShape(sourceId);
        if (!target || !source) return;

        const possibleTargets = allAddReferencedNodeByAction[arrow.type].map(
          (action) => action.destinationType,
        );
        if (!possibleTargets.includes(target.type)) {
          return deleteAndWarn(
            `Target node must be of type ${possibleTargets
              .map((t) => discourseContext.nodes[t].text)
              .join(", ")}`,
          );
        }

        // type check
        if (
          !this.isDiscourseNodeShape(target) ||
          !this.isDiscourseNodeShape(source)
        ) {
          return deleteAndWarn(
            "Invalid shape type. Expected a DiscourseNodeShape.",
          );
        }

        // source and target are expected to be pages
        // TODO: support blocks
        const targetTitle = target.props.title;
        const sourceTitle = source.props.title;
        const isTargetTitleCurrent =
          getPageTitleByPageUid(target.props.uid).trim() === targetTitle.trim();
        const isSourceTitleCurrent =
          getPageTitleByPageUid(source.props.uid).trim() === sourceTitle.trim();
        if (!isTargetTitleCurrent || !isSourceTitleCurrent) {
          return deleteAndWarn(
            "Either the source or target node has been renamed. Please update the nodes and try again.",
          );
        }

        // Hack for default shipped EVD format: [[EVD]] - {content} - {Source},
        // replace when migrating from format to specification
        let newTitle: string;
        if (targetTitle.endsWith(" - ")) {
          newTitle = `${targetTitle}[[${sourceTitle}]]`;
        } else if (targetTitle.endsWith(" -")) {
          newTitle = `${targetTitle} [[${sourceTitle}]]`;
        } else {
          newTitle = `${targetTitle} - [[${sourceTitle}]]`;
        }

        await window.roamAlphaAPI.data.page.update({
          page: { uid: target.props.uid, title: newTitle },
        });
        editor.updateShapes([
          { id: target.id, type: target.type, props: { title: newTitle } },
        ]);

        dispatchToastEvent({
          id: "tldraw-success",
          title: `Updated node title.`,
          severity: "success",
        });
      };

      override getDefaultProps(): DiscourseRelationShape["props"] {
        return {
          dash: "draw",
          size: "m",
          fill: "none",
          color: COLOR_ARRAY[0],
          labelColor: COLOR_ARRAY[1],
          bend: 0,
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          text: "for",
          labelPosition: 0.5,
          font: "draw",
          scale: 1,
        };
      }
      override onHandleDrag: TLOnHandleDragHandler<DiscourseRelationShape> = (
        shape,
        { handle, isPrecise },
      ) => {
        const handleId = handle.id as ARROW_HANDLES;
        const bindings = getArrowBindings(this.editor, shape);

        if (handleId === ARROW_HANDLES.MIDDLE) {
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

          const point = Vec.NearestPointOnLineSegment(A, B, handle, false);
          let bend = Vec.Dist(point, med);
          if (Vec.Clockwise(point, end, med)) bend *= -1;
          return { id: shape.id, type: shape.type, props: { bend } };
        }

        // Start or end, pointing the arrow...

        const update: TLShapePartial<DiscourseRelationShape> = {
          id: shape.id,
          type: action,
          props: {},
        };

        const currentBinding = bindings[handleId];

        const otherHandleId =
          handleId === ARROW_HANDLES.START
            ? ARROW_HANDLES.END
            : ARROW_HANDLES.START;
        const otherBinding = bindings[otherHandleId];

        if (this.editor.inputs.ctrlKey) {
          // todo: maybe double check that this isn't equal to the other handle too?
          // Skip binding
          removeArrowBinding(this.editor, shape, handleId);

          update.props![handleId] = { x: handle.x, y: handle.y };
          return update;
        }

        const point = this.editor
          .getShapePageTransform(shape.id)!
          .applyToPoint(handle);

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
                binding: action,
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
          update.props![handleId] = { x: handle.x, y: handle.y };
          return update;
        }

        // we've got a target! the handle is being dragged over a shape, bind to it

        const targetGeometry = this.editor.getShapeGeometry(target);
        const targetBounds = Box.ZeroFix(targetGeometry.bounds);
        const pageTransform = this.editor.getShapePageTransform(update.id)!;
        const pointInPageSpace = pageTransform.applyToPoint(handle);
        const pointInTargetSpace = this.editor.getPointInShapeSpace(
          target,
          pointInPageSpace,
        );

        let precise = isPrecise;

        if (!precise) {
          // If we're switching to a new bound shape, then precise only if moving slowly
          if (
            !currentBinding ||
            (currentBinding && target.id !== currentBinding.toId)
          ) {
            precise = this.editor.inputs.pointerVelocity.len() < 0.5;
          }
        }

        if (!isPrecise) {
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

        const b = {
          terminal: handleId,
          normalizedAnchor,
          isPrecise: precise,
          isExact: this.editor.inputs.altKey,
        };

        createOrUpdateArrowBinding(this.editor, shape, target.id, b);

        this.editor.setHintingShapes([target.id]);

        const newBindings = getArrowBindings(this.editor, shape);
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
            createOrUpdateArrowBinding(
              this.editor,
              shape,
              newBindings.end.toId,
              {
                ...newBindings.end.props,
                normalizedAnchor: {
                  x: newBindings.end.props.normalizedAnchor.x + 0.05,
                  y: newBindings.end.props.normalizedAnchor.y,
                },
              },
            );
          }
        }

        return update;
      };
      override onTranslate?: TLOnTranslateHandler<DiscourseRelationShape> = (
        initialShape,
        shape,
      ) => {
        const atTranslationStart = shapeAtTranslationStart.get(initialShape);
        if (!atTranslationStart) return;

        const shapePageTransform = this.editor.getShapePageTransform(shape.id)!;
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
                  binding: action,
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
              x:
                (pointInTargetSpace.x - targetBounds.minX) / targetBounds.width,
              y:
                (pointInTargetSpace.y - targetBounds.minY) /
                targetBounds.height,
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
      };
    }
    return ReferencedNodeUtil;
  });
};

export const createAllRelationShapeUtils = (
  allRelationIds: string[],
): TLShapeUtilConstructor<DiscourseRelationShape>[] => {
  return allRelationIds.map((id) => {
    class DiscourseRelationUtil extends BaseDiscourseRelationUtil {
      static override type = id;

      handleCreateRelationsInRoam = ({
        arrow,
        targetId,
      }: {
        arrow: DiscourseRelationShape;
        targetId: TLShapeId;
      }) => {
        const editor = this.editor;
        const deleteAndWarn = (content: string) => {
          dispatchToastEvent({
            id: `tldraw-cancel-and-warn-${content}`,
            title: content,
            severity: "warning",
          });
          this.editor.deleteShapes([arrow.id]);
        };
        const target = editor.getShape(targetId);
        const bindings = editor.getBindingsFromShape(arrow, arrow.type);
        const sourceId = bindings.find((b) => b.toId !== targetId)?.toId;
        if (!sourceId) return;
        const source = editor.getShape(sourceId);
        if (!target || !source) return;
        const relations = Object.values(discourseContext.relations).flat();
        const relation = relations.find((r) => r.id === arrow.type);
        if (!relation) return;
        const possibleTargets = discourseContext.relations[relation.label]
          .filter((r) => r.source === relation.source)
          .map((r) => r.destination);

        if (!possibleTargets.includes(target.type)) {
          const uniqueTargets = [...new Set(possibleTargets)];
          const uniqueTargetTexts = uniqueTargets.map(
            (t) => discourseContext.nodes[t].text,
          );
          return deleteAndWarn(
            `Target node must be of type ${uniqueTargetTexts.join(", ")}`,
          );
        }
        if (arrow.type !== target.type) {
          editor.updateShapes([{ id: arrow.id, type: target.type }]);
        }
        const { triples, label: relationLabel } = relation;
        const isOriginal = arrow.props.text === relationLabel;
        const newTriples = triples
          .map((t) => {
            if (/is a/i.test(t[1])) {
              const targetNode =
                (t[2] === "source" && isOriginal) ||
                (t[2] === "destination" && !isOriginal)
                  ? source
                  : target;
              const { title, uid } =
                targetNode.props as DiscourseNodeShape["props"];
              return [
                t[0],
                isPageUid(uid) ? "has title" : "with uid",
                isPageUid(uid) ? title : uid,
              ];
            }
            return t.slice(0);
          })
          .map(([source, relation, target]) => ({ source, relation, target }));
        const parentUid = getCurrentPageUid();
        const title = getPageTitleByPageUid(parentUid);
        triplesToBlocks({
          defaultPageTitle: `Auto generated from [[${title}]]`,
          toPage: async (title: string, blocks: InputTextNode[]) => {
            const parentUid =
              getPageUidByPageTitle(title) ||
              (await createPage({ title: title }));

            await Promise.all(
              blocks.map((node, order) =>
                createBlock({ node, order, parentUid }).catch(() =>
                  console.error(
                    `Failed to create block: ${JSON.stringify(
                      { node, order, parentUid },
                      null,
                      4,
                    )}`,
                  ),
                ),
              ),
            );
            await openBlockInSidebar(parentUid);
          },
          nodeSpecificationsByLabel: Object.fromEntries(
            Object.values(discourseContext.nodes).map((n) => [
              n.text,
              n.specification,
            ]),
          ),
        })(newTriples)();
      };

      override getDefaultProps(): DiscourseRelationShape["props"] {
        // TODO: get color from canvasSettings

        const relations = Object.values(discourseContext.relations);
        // TODO - add canvas settings to relations config
        const relationIndex = relations.findIndex((rs) =>
          rs.some((r) => r.id === id),
        );
        const isValid = relationIndex >= 0 && relationIndex < relations.length;
        const color = isValid ? COLOR_ARRAY[relationIndex + 1] : COLOR_ARRAY[0];
        const text = isValid ? relations[relationIndex][0].label : "";

        return {
          dash: "draw",
          size: "m",
          fill: "none",
          color: color,
          labelColor: color,
          bend: 0,
          start: { x: 0, y: 0 },
          end: { x: 0, y: 0 },
          arrowheadStart: "none",
          arrowheadEnd: "arrow",
          text: text,
          labelPosition: 0.5,
          font: "draw",
          scale: 1,
        };
      }
      override onHandleDrag: TLOnHandleDragHandler<DiscourseRelationShape> = (
        shape,
        { handle, isPrecise },
      ) => {
        const handleId = handle.id as ARROW_HANDLES;
        const bindings = getArrowBindings(this.editor, shape);

        if (handleId === ARROW_HANDLES.MIDDLE) {
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

          const point = Vec.NearestPointOnLineSegment(A, B, handle, false);
          let bend = Vec.Dist(point, med);
          if (Vec.Clockwise(point, end, med)) bend *= -1;
          return { id: shape.id, type: shape.type, props: { bend } };
        }

        // Start or end, pointing the arrow...

        const update: TLShapePartial<DiscourseRelationShape> = {
          id: shape.id,
          type: id,
          props: {},
        };

        const currentBinding = bindings[handleId];

        const otherHandleId =
          handleId === ARROW_HANDLES.START
            ? ARROW_HANDLES.END
            : ARROW_HANDLES.START;
        const otherBinding = bindings[otherHandleId];

        if (this.editor.inputs.ctrlKey) {
          // todo: maybe double check that this isn't equal to the other handle too?
          // Skip binding
          removeArrowBinding(this.editor, shape, handleId);

          update.props![handleId] = { x: handle.x, y: handle.y };
          return update;
        }

        const point = this.editor
          .getShapePageTransform(shape.id)!
          .applyToPoint(handle);

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
                binding: id,
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
          update.props![handleId] = { x: handle.x, y: handle.y };
          return update;
        }

        // we've got a target! the handle is being dragged over a shape, bind to it

        const targetGeometry = this.editor.getShapeGeometry(target);
        const targetBounds = Box.ZeroFix(targetGeometry.bounds);
        const pageTransform = this.editor.getShapePageTransform(update.id)!;
        const pointInPageSpace = pageTransform.applyToPoint(handle);
        const pointInTargetSpace = this.editor.getPointInShapeSpace(
          target,
          pointInPageSpace,
        );

        let precise = isPrecise;

        if (!precise) {
          // If we're switching to a new bound shape, then precise only if moving slowly
          if (
            !currentBinding ||
            (currentBinding && target.id !== currentBinding.toId)
          ) {
            precise = this.editor.inputs.pointerVelocity.len() < 0.5;
          }
        }

        if (!isPrecise) {
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

        const b = {
          terminal: handleId,
          normalizedAnchor,
          isPrecise: precise,
          isExact: this.editor.inputs.altKey,
        };

        createOrUpdateArrowBinding(this.editor, shape, target.id, b);

        this.editor.setHintingShapes([target.id]);

        const newBindings = getArrowBindings(this.editor, shape);
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
            createOrUpdateArrowBinding(
              this.editor,
              shape,
              newBindings.end.toId,
              {
                ...newBindings.end.props,
                normalizedAnchor: {
                  x: newBindings.end.props.normalizedAnchor.x + 0.05,
                  y: newBindings.end.props.normalizedAnchor.y,
                },
              },
            );
          }
        }

        return update;
      };
      override onTranslate?: TLOnTranslateHandler<DiscourseRelationShape> = (
        initialShape,
        shape,
      ) => {
        const atTranslationStart = shapeAtTranslationStart.get(initialShape);
        if (!atTranslationStart) return;

        const shapePageTransform = this.editor.getShapePageTransform(shape.id)!;
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
                  binding: id,
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
              x:
                (pointInTargetSpace.x - targetBounds.minX) / targetBounds.width,
              y:
                (pointInTargetSpace.y - targetBounds.minY) /
                targetBounds.height,
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
      };
    }
    return DiscourseRelationUtil;
  });
};

export type RelationShapeProps = RecordPropsType<typeof arrowShapeProps>;
export type DiscourseRelationShape = TLBaseShape<string, RelationShapeProps>;

export class BaseDiscourseRelationUtil extends ShapeUtil<DiscourseRelationShape> {
  static override props = arrowShapeProps;

  cancelAndWarn = (title: string) => {
    this.editor.setCurrentTool("select");
    dispatchToastEvent({
      id: `tldraw-cancel-and-warn-${title}`,
      title,
      severity: "warning",
    });
  };

  override canEdit = () => true;
  override canSnap = () => false;
  override hideResizeHandles: TLShapeUtilFlag<DiscourseRelationShape> = () =>
    true;
  override hideRotateHandle: TLShapeUtilFlag<DiscourseRelationShape> = () =>
    true;
  override hideSelectionBoundsBg: TLShapeUtilFlag<DiscourseRelationShape> =
    () => true;
  override hideSelectionBoundsFg: TLShapeUtilFlag<DiscourseRelationShape> =
    () => true;

  override canBind({
    toShapeType,
  }: TLShapeUtilCanBindOpts<DiscourseRelationShape>): boolean {
    // bindings can go from arrows to shapes, but not from shapes to arrows
    return toShapeType !== "arrow";
  }

  override canBeLaidOut: TLShapeUtilFlag<DiscourseRelationShape> = () => {
    return false;
  };

  override getDefaultProps(): DiscourseRelationShape["props"] {
    return {
      dash: "draw",
      size: "m",
      fill: "none",
      color: "red",
      labelColor: "red",
      bend: 0,
      start: { x: 0, y: 0 },
      end: { x: 0, y: 0 },
      arrowheadStart: "none",
      arrowheadEnd: "arrow",
      text: "",
      labelPosition: 0.5,
      font: "draw",
      scale: 1,
    };
  }

  getGeometry(shape: DiscourseRelationShape) {
    const info = getArrowInfo(this.editor, shape)!;

    const debugGeom: Geometry2d[] = [];

    const bodyGeom = info.isStraight
      ? new Edge2d({
          start: Vec.From(info.start.point),
          end: Vec.From(info.end.point),
        })
      : new Arc2d({
          center: Vec.Cast(info.handleArc.center),
          start: Vec.Cast(info.start.point),
          end: Vec.Cast(info.end.point),
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

  override onTranslateStart: TLOnTranslateStartHandler<DiscourseRelationShape> =
    (shape) => {
      const bindings = getArrowBindings(this.editor, shape);

      const terminalsInArrowSpace = getArrowTerminalsInArrowSpace(
        this.editor,
        shape,
        bindings,
      );
      const shapePageTransform = this.editor.getShapePageTransform(shape.id)!;

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
    };

  private readonly _resizeInitialBindings = new WeakCache<
    DiscourseRelationShape,
    RelationBindings
  >();

  override onResize: TLOnResizeHandler<DiscourseRelationShape> = (
    shape,
    info,
  ) => {
    const { scaleX, scaleY } = info;

    const bindings = this._resizeInitialBindings.get(shape, () =>
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
  };

  override onDoubleClickHandle = (
    shape: DiscourseRelationShape,
    handle: TLHandle,
  ): TLShapePartial<DiscourseRelationShape> | void => {
    switch (handle.id) {
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
  };

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

    if (isEditing && labelGeometry) {
      return (
        <rect
          x={toDomPrecision(labelGeometry.x)}
          y={toDomPrecision(labelGeometry.y)}
          width={labelGeometry.w}
          height={labelGeometry.h}
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
                  x={toDomPrecision(labelGeometry.x)}
                  y={toDomPrecision(labelGeometry.y)}
                  width={labelGeometry.w}
                  height={labelGeometry.h}
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
            x={toDomPrecision(labelGeometry.x)}
            y={toDomPrecision(labelGeometry.y)}
            width={labelGeometry.w}
            height={labelGeometry.h}
            rx={3.5}
            ry={3.5}
          />
        )}
      </g>
    );
  }

  override onEditEnd: TLOnEditEndHandler<DiscourseRelationShape> = (shape) => {
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
  };

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
            id={shape.id}
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
}
