import { StateNode, TLEventHandlers, TLStateNodeConstructor } from "tldraw";
import { createShapeId } from "tldraw";
import type { TFile } from "obsidian";
import DiscourseGraphPlugin from "~/index";
import { getRelationTypeById } from "~/utils/typeUtils";
import { DiscourseRelationShape } from "./shapes/DiscourseRelationShape";
import { getNodeTypeById } from "~/utils/typeUtils";
import { showToast } from "./utils/toastUtils";
import { DEFAULT_TLDRAW_COLOR } from "~/utils/tldrawColors";

type RelationToolContext = {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  relationTypeId: string;
  onRelationComplete?: () => void;
} | null;

let relationToolContext: RelationToolContext = null;

export const setDiscourseRelationToolContext = (
  args: RelationToolContext,
): void => {
  relationToolContext = args;
};

export const clearDiscourseRelationToolContext = (): void => {
  relationToolContext = null;
};

export class DiscourseRelationTool extends StateNode {
  static override id = "discourse-relation";
  static override initial = "idle";
  static override children = (): TLStateNodeConstructor[] => [Idle, Pointing];

  override onEnter = () => {
    this.editor.setCursor({ type: "cross" });
  };
}

class Idle extends StateNode {
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
        this.editor.getShapeUtil(onlySelectedShape).canEdit(onlySelectedShape)
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
}

class Pointing extends StateNode {
  static override id = "pointing";
  shape?: DiscourseRelationShape;
  markId = "";

  private showWarning = (message: string) => {
    showToast({
      severity: "warning",
      title: "Relation Tool",
      description: message,
      targetCanvasId: relationToolContext?.canvasFile.path,
    });
    this.cancel();
  };

  private getCompatibleNodeTypes = (
    plugin: DiscourseGraphPlugin,
    relationTypeId: string,
    sourceNodeTypeId: string,
  ): string[] => {
    const compatibleTypes: string[] = [];

    // Find all discourse relations that match the relation type and source
    const relations = plugin.settings.discourseRelations.filter(
      (relation) =>
        relation.relationshipTypeId === relationTypeId &&
        relation.sourceId === sourceNodeTypeId,
    );

    relations.forEach((relation) => {
      compatibleTypes.push(relation.destinationId);
    });

    // Also check reverse relations (where current node is destination)
    const reverseRelations = plugin.settings.discourseRelations.filter(
      (relation) =>
        relation.relationshipTypeId === relationTypeId &&
        relation.destinationId === sourceNodeTypeId,
    );

    reverseRelations.forEach((relation) => {
      compatibleTypes.push(relation.sourceId);
    });

    return [...new Set(compatibleTypes)]; // Remove duplicates
  };

  override onEnter = () => {
    this.didTimeout = false;

    const target = this.editor.getShapeAtPoint(
      this.editor.inputs.currentPagePoint,
    );

    if (!relationToolContext) {
      this.showWarning("No relation type selected");
      return;
    }

    const plugin = relationToolContext.plugin;
    const relationTypeId = relationToolContext.relationTypeId;

    // Validate source node
    if (!target || target.type !== "discourse-node") {
      this.showWarning("Must start on a discourse node");
      return;
    }

    const sourceNodeTypeId = (target as { props?: { nodeTypeId?: string } })
      .props?.nodeTypeId;
    if (!sourceNodeTypeId) {
      this.showWarning("Source node must have a valid node type");
      return;
    }

    // Check if this source node type can create relations of this type
    if (sourceNodeTypeId) {
      const compatibleTargetTypes = this.getCompatibleNodeTypes(
        plugin,
        relationTypeId,
        sourceNodeTypeId,
      );

      if (compatibleTargetTypes.length === 0) {
        const sourceNodeType = getNodeTypeById(plugin, sourceNodeTypeId);
        const relationType = getRelationTypeById(plugin, relationTypeId);
        this.showWarning(
          `Node type "${sourceNodeType?.name}" cannot create "${relationType?.label}" relations`,
        );
        return;
      }
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

      this.updateArrowShapeEndHandle();

      this.editor.setCurrentTool("select.dragging_handle", {
        shape: this.shape,
        handle: { id: "end", type: "vertex", index: "a3", x: 0, y: 0 },
        isCreating: true,
        onInteractionEnd: "select",
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

    if (!relationToolContext) {
      this.showWarning("Must start on a node");
      return;
    }

    const relationType = getRelationTypeById(
      relationToolContext.plugin,
      relationToolContext.relationTypeId,
    );

    this.editor.createShape<DiscourseRelationShape>({
      id,
      type: "discourse-relation",
      x: originPagePoint.x,
      y: originPagePoint.y,
      props: {
        relationTypeId: relationToolContext.relationTypeId,
        text: relationType?.label ?? "",
        color: relationType?.color ?? DEFAULT_TLDRAW_COLOR,
        scale: this.editor.user.getIsDynamicResizeMode()
          ? 1 / this.editor.getZoomLevel()
          : 1,
      },
    });

    const shape = this.editor.getShape<DiscourseRelationShape>(id);
    if (!shape) throw Error(`expected shape`);

    const handles = this.editor.getShapeHandles(shape);
    if (!handles) throw Error(`expected handles for arrow`);

    const util =
      this.editor.getShapeUtil<DiscourseRelationShape>("discourse-relation");
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
    {
      const util =
        this.editor.getShapeUtil<DiscourseRelationShape>("discourse-relation");
      const initial = this.shape;
      const startHandle = handles.find((h) => h.id === "start")!;
      const change = util.onHandleDrag?.(shape, {
        handle: { ...startHandle, x: 0, y: 0 },
        isPrecise: this.didTimeout,
        initial: initial,
      });

      if (change) {
        this.editor.updateShapes([change]);
      }
    }

    // end update
    {
      const util =
        this.editor.getShapeUtil<DiscourseRelationShape>("discourse-relation");
      const initial = this.shape;
      const point = this.editor.getPointInShapeSpace(
        shape,
        this.editor.inputs.currentPagePoint,
      );
      const endHandle = handles.find((h) => h.id === "end")!;
      const change = util.onHandleDrag?.(this.editor.getShape(shape)!, {
        handle: { ...endHandle, x: point.x, y: point.y },
        isPrecise: false,
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
}
