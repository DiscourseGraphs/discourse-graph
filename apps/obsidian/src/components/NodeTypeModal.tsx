import { SuggestModal } from "obsidian";
import type { DiscourseNode } from "~/types";
import type DiscourseGraphPlugin from "~/index";

export class NodeTypeModal extends SuggestModal<DiscourseNode> {
  private nodeTypes: DiscourseNode[];
  private onSelect: (nodeType: DiscourseNode) => void;

  constructor(
    plugin: DiscourseGraphPlugin,
    onSelect: (nodeType: DiscourseNode) => void,
  ) {
    super(plugin.app);
    this.nodeTypes = plugin.settings.nodeTypes;
    this.onSelect = onSelect;
  }

  getItemText(item: DiscourseNode): string {
    return item.name;
  }

  getSuggestions(): DiscourseNode[] {
    const query = this.inputEl.value.toLowerCase();
    return this.nodeTypes.filter((node) =>
      this.getItemText(node).toLowerCase().includes(query),
    );
  }

  renderSuggestion(nodeType: DiscourseNode, el: HTMLElement): void {
    const container = el.createDiv({ cls: "flex items-center gap-2" });
    if (nodeType.color) {
      container.createDiv({
        cls: "h-4 w-4 rounded-full",
        attr: { style: `background-color: ${nodeType.color};` },
      });
    }
    container.createDiv({ text: nodeType.name });
  }

  onChooseSuggestion(nodeType: DiscourseNode): void {
    this.onSelect(nodeType);
  }
}
