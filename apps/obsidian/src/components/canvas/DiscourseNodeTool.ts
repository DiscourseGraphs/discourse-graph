import { StateNode, TLPointerEventInfo } from "@tldraw/editor";

export class DiscourseNodeTool extends StateNode {
  static override id = "discourse-node";
  override onPointerDown = (_info: TLPointerEventInfo) => {
    this.editor.setCurrentTool("select");
  };
}
