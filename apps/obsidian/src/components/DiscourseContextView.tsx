import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import DiscourseGraphPlugin from "../index";
import { getDiscourseNodeFormatExpression } from "../utils/getDiscourseNodeFormatExpression";

export const VIEW_TYPE_DISCOURSE_CONTEXT = "discourse-context-view";

interface DiscourseContextProps {
  activeFile: TFile | null;
  plugin: DiscourseGraphPlugin;
}

function DiscourseContext({ activeFile, plugin }: DiscourseContextProps) {
  const extractContentFromTitle = (
    format: string | undefined,
    title: string,
  ): string => {
    if (!format) return "";
    const regex = getDiscourseNodeFormatExpression(format);
    const match = title.match(regex);
    return match?.[1] ?? title;
  };

  const renderContent = () => {
    if (!activeFile) {
      return <div>No file is open</div>;
    }

    const cache = plugin.app.metadataCache.getFileCache(activeFile);
    if (!cache) {
      return <div>File metadata not available</div>;
    }

    const frontmatter = cache.frontmatter;
    if (!frontmatter) {
      return <div>No discourse node data found</div>;
    }

    if (!frontmatter.nodeTypeId) {
      return <div>Not a discourse node (no nodeTypeId)</div>;
    }

    const nodeType = plugin.settings.nodeTypes.find(
      (type) => type.id === frontmatter.nodeTypeId,
    );

    if (!nodeType) {
      return <div>Unknown node type: {frontmatter.nodeTypeId}</div>;
    }
    return (
      <>
        <div>
          <div
            style={{
              fontSize: "1.2em",
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            {nodeType.name || "Unnamed Node Type"}
          </div>

          {nodeType.format && (
            <div style={{ marginBottom: "4px" }}>
              <span style={{ fontWeight: "bold" }}>Content: </span>
              {extractContentFromTitle(nodeType.format, activeFile.basename)}
            </div>
          )}
        </div>
      </>
    );
  };

  return (
    <div>
      <h4 style={{ marginTop: 0 }}>Discourse Context</h4>
      {renderContent()}
    </div>
  );
}

export class DiscourseContextView extends ItemView {
  private plugin: DiscourseGraphPlugin;
  private activeFile: TFile | null = null;
  private root: Root | null = null;

  constructor(leaf: WorkspaceLeaf, plugin: DiscourseGraphPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  setActiveFile(file: TFile | null): void {
    this.activeFile = file;
    this.updateView();
  }

  getViewType(): string {
    return VIEW_TYPE_DISCOURSE_CONTEXT;
  }

  getDisplayText(): string {
    return "Discourse Context";
  }

  getIcon(): string {
    return "telescope";
  }

  async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    if (container) {
      container.empty();
      container.addClass("discourse-context-container");

      this.root = createRoot(container);

      this.activeFile = this.app.workspace.getActiveFile();

      this.updateView();

      this.registerEvent(
        this.app.workspace.on("file-open", (file) => {
          this.activeFile = file;
          this.updateView();
        }),
      );
    }
  }

  updateView(): void {
    if (this.root) {
      this.root.render(
        <DiscourseContext activeFile={this.activeFile} plugin={this.plugin} />,
      );
    }
  }

  async onClose(): Promise<void> {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
