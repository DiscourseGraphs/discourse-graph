import {
  ItemView,
  TFile,
  WorkspaceLeaf,
  Notice,
  FrontMatterCache,
} from "obsidian";
import { createRoot, Root } from "react-dom/client";
import DiscourseGraphPlugin from "~/index";
import { getDiscourseNodeFormatExpression } from "~/utils/getDiscourseNodeFormatExpression";
import { RelationshipSection } from "~/components/RelationshipSection";
import { VIEW_TYPE_DISCOURSE_CONTEXT } from "~/types";
import { PluginProvider, usePlugin } from "~/components/PluginContext";
import { getNodeTypeById } from "~/utils/typeUtils";
import { refreshImportedFile } from "~/utils/importNodes";
import { publishNode } from "~/utils/publishNode";
import { useState, useEffect } from "react";

type DiscourseContextProps = {
  activeFile: TFile | null;
};

const DiscourseContext = ({ activeFile }: DiscourseContextProps) => {
  const plugin = usePlugin();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    if (!activeFile || !plugin) {
      setIsPublished(false);
      return;
    }
    const fileMetadata = plugin.app.metadataCache.getFileCache(activeFile);
    const frontmatter = fileMetadata?.frontmatter;
    if (!frontmatter) {
      setIsPublished(false);
      return;
    }
    const isImported = !!frontmatter.importedFromSpaceUri;
    const publishedToGroups = frontmatter.publishedToGroups as unknown;
    const published =
      !isImported &&
      Array.isArray(publishedToGroups) &&
      publishedToGroups.length > 0;
    setIsPublished(published);
  }, [activeFile?.path, plugin]);

  const extractContentFromTitle = (format: string, title: string): string => {
    if (!format) return "";
    const regex = getDiscourseNodeFormatExpression(format);
    const match = title.match(regex);
    return match?.[1] ?? title;
  };

  const handleRefresh = async () => {
    if (!activeFile || isRefreshing) return;

    setIsRefreshing(true);
    try {
      const result = await refreshImportedFile({ plugin, file: activeFile });
      if (result.success) {
        new Notice("File refreshed successfully", 3000);
      } else {
        new Notice(
          `Failed to refresh file: ${result.error || "Unknown error"}`,
          5000,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Refresh failed: ${errorMessage}`, 5000);
      console.error("Refresh failed:", error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePublish = async (frontmatter: FrontMatterCache) => {
    if (!activeFile || isPublishing) return;

    if (!frontmatter.nodeInstanceId) {
      new Notice("Please sync the node first", 5000);
      return;
    }

    setIsPublishing(true);
    try {
      await publishNode({ plugin, file: activeFile, frontmatter });
      new Notice("Published successfully", 3000);
      setIsPublished(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      new Notice(`Publish failed: ${errorMessage}`, 5000);
      console.error("Publish failed:", error);
    } finally {
      setIsPublishing(false);
    }
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

    const nodeType = getNodeTypeById(plugin, frontmatter.nodeTypeId as string);

    if (!nodeType) {
      return <div>Unknown node type: {frontmatter.nodeTypeId}</div>;
    }

    const isImported = !!frontmatter.importedFromSpaceUri;
    const modifiedAt =
      typeof frontmatter.lastModified === "number"
        ? frontmatter.lastModified
        : activeFile.stat.mtime;
    const sourceDates =
      isImported && activeFile?.stat
        ? {
            createdAt: new Date(activeFile.stat.ctime).toLocaleString(),
            modifiedAt: new Date(modifiedAt).toLocaleString(),
          }
        : null;

    const canPublish =
      plugin.settings.syncModeEnabled &&
      !isImported &&
      !!frontmatter.nodeTypeId;

    return (
      <>
        <div className="mb-6">
          <div className="text-md mb-2 flex items-center gap-2 font-bold">
            {nodeType.color && (
              <div
                className="h-4 w-4 rounded-full"
                style={{ backgroundColor: nodeType.color }}
              />
            )}
            {nodeType.name || "Unnamed Node Type"}
            {isImported && (
              <button
                onClick={() => {
                  void handleRefresh();
                }}
                disabled={isRefreshing}
                className="ml-auto rounded border px-2 py-1 text-xs"
                title="Refresh from source"
              >
                {isRefreshing ? "Refreshing..." : "🔄 Refresh"}
              </button>
            )}
            {canPublish && (
              <button
                onClick={() => {
                  void handlePublish(frontmatter);
                }}
                disabled={isPublishing}
                className={`ml-auto rounded px-2 py-1 text-xs ${
                  isPublished
                    ? "border border-green-600 bg-green-200 text-green-800 dark:bg-green-900/60 dark:text-green-300"
                    : "border border-gray-400 bg-gray-100 font-medium hover:bg-gray-200 dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700"
                }`}
                title={
                  isPublished
                    ? "Re-publish to lab space"
                    : "Publish to lab space"
                }
              >
                {isPublishing
                  ? "Publishing..."
                  : isPublished
                    ? "✅ Published"
                    : "Publish"}
              </button>
            )}
          </div>

          {nodeType.format && (
            <div className="mb-1">
              <span className="font-bold">Content: </span>
              {extractContentFromTitle(nodeType.format, activeFile.basename)}
            </div>
          )}

          {isImported && sourceDates && (
            <div className="text-modifier-text mt-2 text-xs">
              <div>Created in source: {sourceDates.createdAt}</div>
              <div>Last modified in source: {sourceDates.modifiedAt}</div>
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
      <h3 className="dg-h3">Discourse context</h3>
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
    return "Discourse context";
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
