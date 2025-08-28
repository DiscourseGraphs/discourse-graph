import { StateNode } from "@tldraw/editor";

export class DiscourseNodeTool extends StateNode {
  static override id = "discourse-node";

  override onEnter = () => {
    this.editor.setCursor({ type: "cross" });
  };

  override onPointerDown = () => {
    this.editor.setCurrentTool("select");
  };
}
