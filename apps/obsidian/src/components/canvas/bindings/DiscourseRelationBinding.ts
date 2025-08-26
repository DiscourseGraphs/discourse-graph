import {
  BindingOnShapeChangeOptions,
  BindingUtil,
  TLBaseBinding,
  Vec,
} from "tldraw";
import { DiscourseRelationShape } from "~/components/canvas/shapes/DiscourseRelationShape";
import { DiscourseNodeShape } from "~/components/canvas/shapes/DiscourseNodeShape";

export type DGRelationBinding = TLBaseBinding<
  "dg-relation",
  {
    terminal: "start" | "end";
  }
>;

export class DiscourseRelationBindingUtil extends BindingUtil<DGRelationBinding> {
  static override type = "dg-relation" as const;

  override getDefaultProps() {
    return { terminal: "start" as const };
  }

  // When the node we are bound to changes, reposition the relation endpoints
  override onAfterChangeToShape({ binding }: BindingOnShapeChangeOptions<DGRelationBinding>): void {
    const relation = this.editor.getShape<DiscourseRelationShape>(binding.fromId);
    const boundNode = this.editor.getShape<DiscourseNodeShape>(binding.toId);
    if (!relation || !boundNode) return;

    // Get centers of both nodes
    const boundCenter = {
      x: boundNode.x + (boundNode.props as any).w / 2,
      y: boundNode.y + (boundNode.props as any).h / 2,
    };

    // Find the other binding for the relation
    const allBindings = this.editor.getBindingsFromShape<DGRelationBinding>(relation, "dg-relation");
    const other = allBindings.find((b) => b.id !== binding.id);
    let otherCenter = boundCenter;
    if (other) {
      const otherNode = this.editor.getShape<DiscourseNodeShape>(other.toId);
      if (otherNode) {
        otherCenter = {
          x: otherNode.x + (otherNode.props as any).w / 2,
          y: otherNode.y + (otherNode.props as any).h / 2,
        };
      }
    }

    const start = binding.props.terminal === "start" ? boundCenter : otherCenter;
    const end = binding.props.terminal === "start" ? otherCenter : boundCenter;

    // Convert to local coordinates by moving the relation to the segment's top-left
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const localStart = { x: start.x - minX, y: start.y - minY };
    const localEnd = { x: end.x - minX, y: end.y - minY };

    this.editor.updateShape<DiscourseRelationShape>({
      id: relation.id,
      type: "discourse-relation",
      x: minX,
      y: minY,
      props: {
        ...relation.props,
        start: localStart,
        end: localEnd,
      },
    });
  }
}


