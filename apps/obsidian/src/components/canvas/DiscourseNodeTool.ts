import { StateNode, TLPointerEventInfo } from "tldraw";
import type { TFile } from "obsidian";
import DiscourseGraphPlugin from "~/index";
import { getNodeTypeById } from "~/utils/utils";
import { openCreateDiscourseNodeAt } from "./utils/nodeCreationFlow";

type ToolContext = {
  plugin: DiscourseGraphPlugin;
  canvasFile: TFile;
  nodeTypeId?: string;
} | null;

let toolContext: ToolContext = null;

export const setDiscourseNodeToolContext = (args: ToolContext): void => {
  toolContext = args;
};

export class DiscourseNodeTool extends StateNode {
  static override id = "discourse-node";
  override onEnter = () => {
    this.editor.setCursor({
      type: "cross",
      rotation: 45,
    });
  };

  override onPointerDown = (_info?: TLPointerEventInfo) => {
    const { currentPagePoint } = this.editor.inputs;

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

    toolContext = null;
    this.editor.setCurrentTool("select");
  };
}
