import { ItemView, WorkspaceLeaf, TFile } from "obsidian";
import DiscourseGraphPlugin from "../index";

export const VIEW_TYPE_DISCOURSE_CONTEXT = "discourse-context-view";

export class DiscourseContextView extends ItemView {
  private plugin: DiscourseGraphPlugin;
  private activeFile: TFile | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DiscourseGraphPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return VIEW_TYPE_DISCOURSE_CONTEXT;
  }

  getDisplayText(): string {
    return "Discourse Context";
  }

  getIcon(): string {
    return "book";
  }

  async onOpen(): Promise<void> {
    // Set up the container
    const container = this.containerEl.children[1];
    if (container) {
      container.empty();
      container.addClass("frontmatter-viewer-container");

      // Get the currently active file
      this.activeFile = this.app.workspace.getActiveFile();

      // Initial render
      this.updateView();

      // Register event to update when file changes
      this.registerEvent(
        this.app.workspace.on("file-open", (file) => {
          this.activeFile = file;
          this.updateView();
        }),
      );
    }
  }

  /**
   * Sets the active file and updates the view
   */
  setActiveFile(file: TFile | null): void {
    this.activeFile = file;
    this.updateView();
  }

  updateView(): void {
    const container = this.containerEl.children[1] as HTMLElement;
    if (!container) return;

    container.empty();

    if (!this.activeFile) {
      this.displayMessage(container, "No file is open");
      return;
    }

    // Get file frontmatter
    const cache = this.app.metadataCache.getFileCache(this.activeFile);
    if (!cache) {
      this.displayMessage(container, "File metadata not available");
      return;
    }

    const frontmatter = cache.frontmatter;

    if (!frontmatter) {
      this.displayMessage(container, "No frontmatter in this file");
      return;
    }

    // Check if this is a discourse node with a nodeTypeId
    if (!frontmatter.nodeTypeId) {
      this.displayMessage(container, "Not a discourse node (no nodeTypeId)");
      return;
    }

    // Look up the node type from settings
    const nodeType = this.plugin.settings.nodeTypes.find(
      (type) => type.id === frontmatter.nodeTypeId,
    );

    if (!nodeType) {
      this.displayMessage(
        container,
        `Unknown node type: ${frontmatter.nodeTypeId}`,
      );
      return;
    }

    // Display discourse node context
    const header = container.createEl("h4", { text: "Discourse Context" });
    header.style.marginTop = "0";

    // Node type information
    const nodeTypeInfo = container.createEl("div", { cls: "node-type-info" });

    const nodeTypeName = nodeTypeInfo.createEl("div", {
      cls: "node-type-name",
    });
    nodeTypeName.style.fontSize = "1.2em";
    nodeTypeName.style.fontWeight = "bold";
    nodeTypeName.style.marginBottom = "8px";
    nodeTypeName.textContent = nodeType.name || "Unnamed Node Type";

    // Add node ID info
    const nodeId = nodeTypeInfo.createEl("div", { cls: "node-id" });
    nodeId.style.fontSize = "0.9em";
    nodeId.style.opacity = "0.8";
    nodeId.style.marginBottom = "16px";
    nodeId.textContent = `ID: ${frontmatter.nodeTypeId}`;

    // Show other node properties if available
    if (nodeType.format) {
      const format = nodeTypeInfo.createEl("div");
      format.style.marginBottom = "4px";
      const formatLabel = format.createEl("span");
      formatLabel.style.fontWeight = "bold";
      formatLabel.textContent = "Format: ";
      format.createSpan({ text: nodeType.format });
    }

    if (nodeType.shortcut) {
      const shortcut = nodeTypeInfo.createEl("div");
      shortcut.style.marginBottom = "4px";
      const shortcutLabel = shortcut.createEl("span");
      shortcutLabel.style.fontWeight = "bold";
      shortcutLabel.textContent = "Shortcut: ";
      shortcut.createSpan({ text: nodeType.shortcut });
    }

    // Divider
    const divider = container.createEl("hr");
    divider.style.margin = "16px 0";

    // Other frontmatter properties
    if (Object.keys(frontmatter).length > 1) {
      // More than just nodeTypeId
      const otherPropsHeader = container.createEl("h5", {
        text: "Other Properties",
      });
      otherPropsHeader.style.marginTop = "8px";

      const frontmatterDiv = container.createEl("div", {
        cls: "frontmatter-content",
      });

      // Create a list of frontmatter properties
      const list = frontmatterDiv.createEl("ul");
      list.style.paddingLeft = "20px";

      Object.entries(frontmatter).forEach(([key, value]) => {
        // Skip nodeTypeId as we display it prominently
        if (key === "nodeTypeId") return;

        const item = list.createEl("li");
        const keySpan = item.createEl("span", { cls: "frontmatter-key" });
        keySpan.style.fontWeight = "bold";
        keySpan.textContent = key + ": ";

        const valueSpan = item.createEl("span");
        valueSpan.textContent =
          typeof value === "object" ? JSON.stringify(value) : String(value);
      });
    }
  }

  private displayMessage(container: HTMLElement, message: string): void {
    const messageEl = container.createEl("div", { cls: "frontmatter-message" });
    messageEl.style.textAlign = "center";
    messageEl.style.marginTop = "20px";
    messageEl.style.color = "var(--text-muted)";
    messageEl.textContent = message;
  }

  async onClose(): Promise<void> {
    // Clean up
    this.containerEl.empty();
  }
}
