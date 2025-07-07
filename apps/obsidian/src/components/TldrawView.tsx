import { ItemView, MarkdownView, WorkspaceLeaf } from "obsidian";
import { VIEW_TYPE_TLDRAW_DG } from "~/constants";
import type DiscourseGraphPlugin from "~/index";

export class TldrawView extends ItemView {
  plugin: DiscourseGraphPlugin;

  constructor(leaf: WorkspaceLeaf, plugin: DiscourseGraphPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_TLDRAW_DG;
  }

  getDisplayText(): string {
    return "Discourse Graph Canvas";
  }

  async onOpen() {
    await this.leaf.setViewState({
      type: "markdown",
      state: this.leaf.view.getState(),
    });
  }

  async onClose() {
    // Nothing to cleanup
  }
}
