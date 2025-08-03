import { App, Editor, SuggestModal, TFile, Notice } from "obsidian";
import { DiscourseNode } from "~/types";
import { createDiscourseNode } from "~/utils/createNode";
import type DiscourseGraphPlugin from "~/index";

export class NodeTypeModal extends SuggestModal<DiscourseNode> {
  constructor(
    private editor: Editor,
    private nodeTypes: DiscourseNode[],
    private plugin: DiscourseGraphPlugin,
  ) {
    super(plugin.app);
  }

  getItemText(item: DiscourseNode): string {
    return item.name;
  }

  getSuggestions() {
    const query = this.inputEl.value.toLowerCase();
    return this.nodeTypes.filter((node) =>
      this.getItemText(node).toLowerCase().includes(query),
    );
  }

  renderSuggestion(nodeType: DiscourseNode, el: HTMLElement) {
    const container = el.createDiv({ cls: "flex items-center gap-2" });
    if (nodeType.color) {
      container.createDiv({
        cls: "h-4 w-4 rounded-full",
        attr: { style: `background-color: ${nodeType.color};` },
      });
    }
    container.createDiv({ text: nodeType.name });
  }

  async onChooseSuggestion(nodeType: DiscourseNode) {
    await createDiscourseNode({
      plugin: this.plugin,
      editor: this.editor,
      nodeType,
      text: this.editor.getSelection().trim() || "",
    });
  }
}
