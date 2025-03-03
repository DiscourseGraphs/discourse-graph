import { App, Editor, SuggestModal } from "obsidian";
import { DiscourseNodeType } from "../types";
import { getDiscourseNodeFormatExpression } from "../utils/getDiscourseNodeFormatExpression";

export class NodeTypeModal extends SuggestModal<DiscourseNodeType> {
  constructor(
    app: App,
    private editor: Editor,
    private nodeTypes: DiscourseNodeType[],
  ) {
    super(app);
  }

  getItemText(item: DiscourseNodeType): string {
    return item.name;
  }

  getSuggestions() {
    const query = this.inputEl.value.toLowerCase();
    return this.nodeTypes.filter((node) =>
      this.getItemText(node).toLowerCase().includes(query),
    );
  }

  renderSuggestion(nodeType: DiscourseNodeType, el: HTMLElement) {
    el.createEl("div", { text: nodeType.name });
  }

  onChooseSuggestion(nodeType: DiscourseNodeType) {
    const selectedText = this.editor.getSelection();
    const regex = getDiscourseNodeFormatExpression(nodeType.format);

    const nodeFormat = regex.source.match(/^\^(.*?)\(\.\*\?\)(.*?)\$$/);
    if (!nodeFormat) return;

    const formattedNodeName =
      nodeFormat[1]?.replace(/\\/g, "") +
      selectedText +
      nodeFormat[2]?.replace(/\\/g, "");
    if (!nodeFormat) return;

    this.editor.replaceSelection(`[[${formattedNodeName}]]`);
  }
}
