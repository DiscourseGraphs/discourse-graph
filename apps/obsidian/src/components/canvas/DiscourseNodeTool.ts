import { StateNode, TLPointerEventInfo, Editor } from "tldraw";
import type { TFile } from "obsidian";
import DiscourseGraphPlugin from "~/index";
import { getNodeTypeById } from "~/utils/typeUtils";
import { openCreateDiscourseNodeAt } from "./utils/nodeCreationFlow";

type ToolContext = {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  nodeTypeId?: string;
} | null;

const toolContextMap = new WeakMap<Editor, ToolContext>();

export const setDiscourseNodeToolContext = (
  editor: Editor,
  args: ToolContext,
): void => {
  toolContextMap.set(editor, args);
};

export class DiscourseNodeTool extends StateNode {
  static override id = "discourse-node";

  override onEnter = () => {
    this.editor.setCursor({
      type: "cross",
      rotation: 45,
    });
  };

  override onExit = () => {
    toolContextMap.delete(this.editor);
  };

  // eslint-disable-next-line
  override onPointerDown = (_info?: TLPointerEventInfo) => {
    const { currentPagePoint } = this.editor.inputs;

    const toolContext = toolContextMap.get(this.editor);
    if (!toolContext) {
      this.editor.setCurrentTool("select");
      return;
    }

    const { plugin, canvasFile, nodeTypeId } = toolContext;
    const initialNodeType = nodeTypeId
      ? (getNodeTypeById(plugin, nodeTypeId) ?? undefined)
      : undefined;

    openCreateDiscourseNodeAt({
      plugin,
      canvasFile,
      tldrawEditor: this.editor,
      position: currentPagePoint,
      initialNodeType,
    });

    toolContextMap.delete(this.editor);
    this.editor.setCurrentTool("select");
  };
}
