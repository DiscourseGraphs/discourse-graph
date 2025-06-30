import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import DiscourseGraphPlugin from "~/index";
import { getDiscourseNodeFormatExpression } from "~/utils/getDiscourseNodeFormatExpression";
import { RelationshipSection } from "~/components/RelationshipSection";
import { VIEW_TYPE_DISCOURSE_CONTEXT } from "~/types";
import { PluginProvider, usePlugin } from "~/components/PluginContext";

type DiscourseContextProps = {
  activeFile: TFile | null;
};

const DiscourseContext = ({ activeFile }: DiscourseContextProps) => {
  const plugin = usePlugin();

  const extractContentFromTitle = (format: string, title: string): string => {
    if (!format) return "";
    const regex = getDiscourseNodeFormatExpression(format);
    const match = title.match(regex);
    return match?.[1] ?? title;
  };

  const renderContent = () => {
    if (!activeFile) {
      return <div>No file is open</div>;
    }

    const fileMetadata = plugin.app.metadataCache.getFileCache(activeFile);
    if (!fileMetadata) {
      return <div>File metadata not available</div>;
    }

    const frontmatter = fileMetadata.frontmatter;
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
        <div className="mb-6">
          <div className="text-md mb-2 font-bold">
            {nodeType.name || "Unnamed Node Type"}
          </div>

          {nodeType.format && (
            <div className="mb-1">
              <span className="font-bold">Content: </span>
              {extractContentFromTitle(nodeType.format, activeFile.basename)}
            </div>
          )}
        </div>

        <div>
          <h4 className="dg-h4 border-modifier-border mb-3 mt-4 border-b pb-1">
            Relationships
          </h4>
          <RelationshipSection key={activeFile.path} activeFile={activeFile} />
        </div>
      </>
    );
  };

  return (
    <div>
      <h3 className="dg-h3">Discourse Context</h3>
      {renderContent()}
    </div>
  );
};

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
        <PluginProvider plugin={this.plugin}>
          <DiscourseContext activeFile={this.activeFile} />
        </PluginProvider>,
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
