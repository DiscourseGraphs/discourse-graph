/* eslint-disable @typescript-eslint/naming-convention */
import {
  StateNode,
  TLEventHandlers,
  createShapeId,
  TLStateNodeConstructor,
} from "tldraw";
import {
  DiscourseRelationShape,
  getRelationColor,
} from "./DiscourseRelationUtil";
import { discourseContext } from "~/components/canvas/Tldraw";
import { dispatchToastEvent } from "~/components/canvas/ToastListener";

export type AddReferencedNodeType = Record<string, ReferenceFormatType[]>;
type ReferenceFormatType = {
  format: string;
  sourceName: string;
  sourceType: string;
  destinationType: string;
  destinationName: string;
};

export const createAllReferencedNodeTools = (
  allAddReferencedNodeByAction: AddReferencedNodeType,
): TLStateNodeConstructor[] => {
  return Object.keys(allAddReferencedNodeByAction).map((action) => {
    class ReferencedNodeTool extends StateNode {
      static override initial = "idle";
      static override id = action;
      static override children = (): TLStateNodeConstructor[] => [
        this.Idle,
        this.Pointing,
      ];

      static Pointing = class extends StateNode {
        static override id = "pointing";
        shape?: DiscourseRelationShape;
        markId = "";

        cancelAndWarn = (content: string) => {
          dispatchToastEvent({
            id: `tldraw-cancel-and-warn-${content}`,
            title: content,
            severity: "warning",
          });
          this.cancel();
        };

        override onEnter = () => {
          this.didTimeout = false;

          const target = this.editor.getShapeAtPoint(
            this.editor.inputs.currentPagePoint,
            // {
            //   filter: (targetShape) => {
            //     return (
            //       !targetShape.isLocked &&
            //       this.editor.canBindShapes({
            //         fromShape: name,
            //         toShape: targetShape,
            //         binding: name,
            //       })
            //     );
            //   },
            //   margin: 0,
            //   hitInside: true,
            //   renderingOnly: true,
            // }
          );

          const sourceType = allAddReferencedNodeByAction[action][0].sourceType;
          const sourceName = allAddReferencedNodeByAction[action][0].sourceName;
          if (target?.type === sourceType) {
            this.shapeType = `${action}`;
          } else {
            this.cancelAndWarn(`Starting node must be one of ${sourceName}`);
          }
          if (!target) {
            this.createArrowShape();
          } else {
            this.editor.setHintingShapes([target.id]);
          }

          this.startPreciseTimeout();
        };

        override onExit = () => {
          this.shape = undefined;
          this.editor.setHintingShapes([]);
          this.clearPreciseTimeout();
        };

        override onPointerMove: TLEventHandlers["onPointerMove"] = () => {
          if (this.editor.inputs.isDragging) {
            if (!this.shape) {
              this.createArrowShape();
            }

            if (!this.shape) throw Error(`expected shape`);

            // const initialEndHandle = this.editor
            //   .getShapeHandles(this.shape)!
            //   .find((h) => h.id === "end")!;
            this.updateArrowShapeEndHandle();

            this.editor.setCurrentTool("select.dragging_handle", {
              shape: this.shape,
              handle: { id: "end", type: "vertex", index: "a3", x: 0, y: 0 },
              isCreating: true,
              onInteractionEnd: action,
            });
          }
        };

        override onPointerUp: TLEventHandlers["onPointerUp"] = () => {
          this.cancel();
        };

        override onCancel: TLEventHandlers["onCancel"] = () => {
          this.cancel();
        };

        override onComplete: TLEventHandlers["onComplete"] = () => {
          this.cancel();
        };

        override onInterrupt: TLEventHandlers["onInterrupt"] = () => {
          this.cancel();
        };

        cancel() {
          if (this.shape) {
            // the arrow might not have been created yet!
            this.editor.bailToMark(this.markId);
          }
          this.editor.setHintingShapes([]);
          this.parent.transition("idle");
        }

        createArrowShape() {
          const { originPagePoint } = this.editor.inputs;

          const id = createShapeId();

          this.markId = `creating:${id}`;
          this.editor.mark(this.markId);

          if (!this.shapeType) {
            this.cancelAndWarn("Must start on a node");
            return;
          }

          this.editor.createShape<DiscourseRelationShape>({
            id,
            type: this.shapeType,
            x: originPagePoint.x,
            y: originPagePoint.y,
            props: {
              // color,
              scale: this.editor.user.getIsDynamicResizeMode()
                ? 1 / this.editor.getZoomLevel()
                : 1,
            },
          });

          const shape = this.editor.getShape<DiscourseRelationShape>(id);
          if (!shape) throw Error(`expected shape`);

          const handles = this.editor.getShapeHandles(shape);
          if (!handles) throw Error(`expected handles for arrow`);

          const util = this.editor.getShapeUtil<DiscourseRelationShape>(
            this.shapeType,
          );
          const initial = this.shape;
          const startHandle = handles.find((h) => h.id === "start")!;
          const change = util.onHandleDrag?.(shape, {
            handle: { ...startHandle, x: 0, y: 0 },
            isPrecise: true,
            initial: initial,
          });

          if (change) {
            this.editor.updateShapes([change]);
          }

          // Cache the current shape after those changes
          this.shape = this.editor.getShape(id);
          this.editor.select(id);
        }

        updateArrowShapeEndHandle() {
          const shape = this.shape;

          if (!shape) throw Error(`expected shape`);

          const handles = this.editor.getShapeHandles(shape);
          if (!handles) throw Error(`expected handles for arrow`);

          // start update
          if (!this.shapeType) {
            this.cancelAndWarn("An error occured.  This shape has no type.");
            return;
          }

          {
            const util = this.editor.getShapeUtil<DiscourseRelationShape>(
              this.shapeType,
            );
            const initial = this.shape;
            const startHandle = handles.find((h) => h.id === "start")!;
            const change = util.onHandleDrag?.(shape, {
              handle: { ...startHandle, x: 0, y: 0 },
              isPrecise: this.didTimeout, // sure about that?
              initial: initial,
            });

            if (change) {
              this.editor.updateShapes([change]);
            }
          }

          // end update
          {
            const util = this.editor.getShapeUtil<DiscourseRelationShape>(
              this.shapeType,
            );
            const initial = this.shape;
            const point = this.editor.getPointInShapeSpace(
              shape,
              this.editor.inputs.currentPagePoint,
            );
            const endHandle = handles.find((h) => h.id === "end")!;
            const change = util.onHandleDrag?.(this.editor.getShape(shape)!, {
              handle: { ...endHandle, x: point.x, y: point.y },
              isPrecise: false, // sure about that?
              initial: initial,
            });

            if (change) {
              this.editor.updateShapes([change]);
            }
          }

          // Cache the current shape after those changes
          this.shape = this.editor.getShape(shape.id);
        }

        public preciseTimeout = -1;
        public didTimeout = false;
        public startPreciseTimeout() {
          this.preciseTimeout = this.editor.timers.setTimeout(() => {
            if (!this.getIsActive()) return;
            this.didTimeout = true;
          }, 320);
        }
        public clearPreciseTimeout() {
          clearTimeout(this.preciseTimeout);
        }
      };

      static Idle = class extends StateNode {
        static override id = "idle";

        override onPointerDown: TLEventHandlers["onPointerDown"] = (info) => {
          this.parent.transition("pointing", info);
        };

        override onEnter = () => {
          this.editor.setCursor({ type: "cross", rotation: 0 });
        };

        override onCancel = () => {
          this.editor.setCurrentTool("select");
        };

        override onKeyUp: TLEventHandlers["onKeyUp"] = (info) => {
          if (info.key === "Enter") {
            if (this.editor.getInstanceState().isReadonly) return null;
            const onlySelectedShape = this.editor.getOnlySelectedShape();
            // If the only selected shape is editable, start editing it
            if (
              onlySelectedShape &&
              this.editor
                .getShapeUtil(onlySelectedShape)
                .canEdit(onlySelectedShape)
            ) {
              this.editor.setCurrentTool("select");
              this.editor.setEditingShape(onlySelectedShape.id);
              this.editor.root.getCurrent()?.transition("editing_shape", {
                ...info,
                target: "shape",
                shape: onlySelectedShape,
              });
            }
          }
        };
      };
    }
    return ReferencedNodeTool;
  });
};

export const createAllRelationShapeTools = (
  relationNames: string[],
): TLStateNodeConstructor[] => {
  return relationNames.map((name) => {
    class RelationShapeTool extends StateNode {
      static override initial = "idle";
      static override id = name;
      static override children = (): TLStateNodeConstructor[] => [
        this.Idle,
        this.Pointing,
      ];

      static Pointing = class extends StateNode {
        static override id = "pointing";
        shape?: DiscourseRelationShape;
        markId = "";

        cancelAndWarn = (title: string) => {
          dispatchToastEvent({
            id: `tldraw-cancel-and-warn-${title}`,
            title,
            severity: "warning",
          });
          this.cancel();
        };

        override onEnter = () => {
          this.didTimeout = false;

          const target = this.editor.getShapeAtPoint(
            this.editor.inputs.currentPagePoint,
            // {
            //   filter: (targetShape) => {
            //     return (
            //       !targetShape.isLocked &&
            //       this.editor.canBindShapes({
            //         fromShape: name,
            //         toShape: targetShape,
            //         binding: name,
            //       })
            //     );
            //   },
            //   margin: 0,
            //   hitInside: true,
            //   renderingOnly: true,
            // }
          );

          const relation = discourseContext.relations[name].find(
            (r) => r.source === target?.type,
          );
          if (relation) {
            this.shapeType = relation.id;
          } else {
            const acceptableTypes = discourseContext.relations[name].map(
              (r) => discourseContext.nodes[r.source].text,
            );
            const uniqueTypes = [...new Set(acceptableTypes)];
            this.cancelAndWarn(
              `Starting node must be one of ${uniqueTypes.join(", ")}`,
            );
          }
          if (!target) {
            this.createArrowShape();
          } else {
            this.editor.setHintingShapes([target.id]);
          }

          this.startPreciseTimeout();
        };

        override onExit = () => {
          this.shape = undefined;
          this.editor.setHintingShapes([]);
          this.clearPreciseTimeout();
        };

        override onPointerMove: TLEventHandlers["onPointerMove"] = () => {
          if (this.editor.inputs.isDragging) {
            if (!this.shape) {
              this.createArrowShape();
            }

            if (!this.shape) throw Error(`expected shape`);

            // const initialEndHandle = this.editor
            //   .getShapeHandles(this.shape)!
            //   .find((h) => h.id === "end")!;
            this.updateArrowShapeEndHandle();

            this.editor.setCurrentTool("select.dragging_handle", {
              shape: this.shape,
              handle: { id: "end", type: "vertex", index: "a3", x: 0, y: 0 },
              isCreating: true,
              onInteractionEnd: name,
            });
          }
        };

        override onPointerUp: TLEventHandlers["onPointerUp"] = () => {
          this.cancel();
        };

        override onCancel: TLEventHandlers["onCancel"] = () => {
          this.cancel();
        };

        override onComplete: TLEventHandlers["onComplete"] = () => {
          this.cancel();
        };

        override onInterrupt: TLEventHandlers["onInterrupt"] = () => {
          this.cancel();
        };

        cancel() {
          if (this.shape) {
            // the arrow might not have been created yet!
            this.editor.bailToMark(this.markId);
          }
          this.editor.setHintingShapes([]);
          this.parent.transition("idle");
        }

        createArrowShape() {
          const { originPagePoint } = this.editor.inputs;

          const id = createShapeId();

          this.markId = `creating:${id}`;
          this.editor.mark(this.markId);

          const color = getRelationColor(name);

          if (!this.shapeType) {
            this.cancelAndWarn("Must start on a node");
            return;
          }

          this.editor.createShape<DiscourseRelationShape>({
            id,
            type: this.shapeType,
            x: originPagePoint.x,
            y: originPagePoint.y,
            props: {
              color,
              scale: this.editor.user.getIsDynamicResizeMode()
                ? 1 / this.editor.getZoomLevel()
                : 1,
            },
          });

          const shape = this.editor.getShape<DiscourseRelationShape>(id);
          if (!shape) throw Error(`expected shape`);

          const handles = this.editor.getShapeHandles(shape);
          if (!handles) throw Error(`expected handles for arrow`);

          const util = this.editor.getShapeUtil<DiscourseRelationShape>(
            this.shapeType,
          );
          const initial = this.shape;
          const startHandle = handles.find((h) => h.id === "start")!;
          const change = util.onHandleDrag?.(shape, {
            handle: { ...startHandle, x: 0, y: 0 },
            isPrecise: true,
            initial: initial,
          });

          if (change) {
            this.editor.updateShapes([change]);
          }

          // Cache the current shape after those changes
          this.shape = this.editor.getShape(id);
          this.editor.select(id);
        }

        updateArrowShapeEndHandle() {
          const shape = this.shape;

          if (!shape) throw Error(`expected shape`);

          const handles = this.editor.getShapeHandles(shape);
          if (!handles) throw Error(`expected handles for arrow`);

          // start update
          if (!this.shapeType) {
            this.cancelAndWarn("An error occured.  This shape has no type.");
            return;
          }

          {
            const util = this.editor.getShapeUtil<DiscourseRelationShape>(
              this.shapeType,
            );
            const initial = this.shape;
            const startHandle = handles.find((h) => h.id === "start")!;
            const change = util.onHandleDrag?.(shape, {
              handle: { ...startHandle, x: 0, y: 0 },
              isPrecise: this.didTimeout, // sure about that?
              initial: initial,
            });

            if (change) {
              this.editor.updateShapes([change]);
            }
          }

          // end update
          {
            const util = this.editor.getShapeUtil<DiscourseRelationShape>(
              this.shapeType,
            );
            const initial = this.shape;
            const point = this.editor.getPointInShapeSpace(
              shape,
              this.editor.inputs.currentPagePoint,
            );
            const endHandle = handles.find((h) => h.id === "end")!;
            const change = util.onHandleDrag?.(this.editor.getShape(shape)!, {
              handle: { ...endHandle, x: point.x, y: point.y },
              isPrecise: false, // sure about that?
              initial: initial,
            });

            if (change) {
              this.editor.updateShapes([change]);
            }
          }

          // Cache the current shape after those changes
          this.shape = this.editor.getShape(shape.id);
        }

        public preciseTimeout = -1;
        public didTimeout = false;
        public startPreciseTimeout() {
          this.preciseTimeout = this.editor.timers.setTimeout(() => {
            if (!this.getIsActive()) return;
            this.didTimeout = true;
          }, 320);
        }
        public clearPreciseTimeout() {
          clearTimeout(this.preciseTimeout);
        }
      };

      static Idle = class extends StateNode {
        static override id = "idle";

        override onPointerDown: TLEventHandlers["onPointerDown"] = (info) => {
          this.parent.transition("pointing", info);
        };

        override onEnter = () => {
          this.editor.setCursor({ type: "cross", rotation: 0 });
        };

        override onCancel = () => {
          this.editor.setCurrentTool("select");
        };

        override onKeyUp: TLEventHandlers["onKeyUp"] = (info) => {
          if (info.key === "Enter") {
            if (this.editor.getInstanceState().isReadonly) return null;
            const onlySelectedShape = this.editor.getOnlySelectedShape();
            // If the only selected shape is editable, start editing it
            if (
              onlySelectedShape &&
              this.editor
                .getShapeUtil(onlySelectedShape)
                .canEdit(onlySelectedShape)
            ) {
              this.editor.setCurrentTool("select");
              this.editor.setEditingShape(onlySelectedShape.id);
              this.editor.root.getCurrent()?.transition("editing_shape", {
                ...info,
                target: "shape",
                shape: onlySelectedShape,
              });
            }
          }
        };
      };
    }

    return RelationShapeTool;
  });
};
