import { App, Editor, SuggestModal, TFile, Notice } from "obsidian";
import { DiscourseNode } from "~/types";
import { processTextToDiscourseNode } from "~/utils/createNodeFromSelectedText";
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
    el.createEl("div", { text: nodeType.name });
  }

  async onChooseSuggestion(nodeType: DiscourseNode) {
    await processTextToDiscourseNode({
      plugin: this.plugin,
      editor: this.editor,
      nodeType,
    });
  }
}
