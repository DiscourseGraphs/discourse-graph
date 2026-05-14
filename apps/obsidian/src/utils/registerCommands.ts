import { App, Editor, MarkdownView, Modal, Notice, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { NodeTypeModal } from "~/components/NodeTypeModal";
import ModifyNodeModal from "~/components/ModifyNodeModal";
import { BulkIdentifyDiscourseNodesModal } from "~/components/BulkIdentifyDiscourseNodesModal";
import { ImportNodesModal } from "~/components/ImportNodesModal";
import { createDiscourseNode } from "./createNode";
import { refreshAllImportedFiles } from "./importNodes";
import { VIEW_TYPE_MARKDOWN, VIEW_TYPE_TLDRAW_DG_PREVIEW } from "~/constants";
import { createCanvas } from "~/components/canvas/utils/tldraw";
import { syncAllNodesAndRelations } from "./syncDgNodesToSupabase";
import { publishNode } from "./publishNode";
import { addRelationIfRequested } from "~/components/canvas/utils/relationJsonUtils";
import type { DiscourseNode } from "~/types";
import { TldrawView } from "~/components/canvas/TldrawView";
import { createBaseForNodeType } from "./baseForNodeType";
import { createPaperGraphCanvasFromCurrentNote } from "./paperCanvasGeneration";
import {
  createPaperDiscourseNodesFromMarkdown,
  extractPaperRelationsForExistingNodes,
  findExistingPaperNodesForSourceFile,
  type CreatedPaperNode,
} from "./paperGraphExtraction";

type ModifyNodeSubmitParams = {
  nodeType: DiscourseNode;
  title: string;
  initialFile?: TFile;
  selectedExistingNode?: TFile;
  relationshipId?: string;
  relationshipTargetFile?: TFile;
};

class AnthropicApiKeyModal extends Modal {
  private onSubmit: (apiKey: string | null) => void;
  private apiKey = "";
  private hasSubmitted = false;

  constructor(app: App, onSubmit: (apiKey: string | null) => void) {
    super(app);
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Paper graph extraction" });
    contentEl.createEl("p", {
      text: "Enter an Anthropic API key for this local demo run.",
    });

    const input = contentEl.createEl("input");
    input.type = "password";
    input.placeholder = "sk-ant-...";
    input.addClass("dg-paper-extraction-api-key-input");
    input.addEventListener("input", () => {
      this.apiKey = input.value.trim();
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.submit();
      }
    });

    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
    });

    buttonContainer
      .createEl("button", {
        text: "Cancel",
        cls: "mod-normal",
      })
      .addEventListener("click", () => this.close());

    buttonContainer
      .createEl("button", {
        text: "Extract",
        cls: "mod-cta",
      })
      .addEventListener("click", () => this.submit());

    input.focus();
  }

  onClose(): void {
    if (!this.hasSubmitted) {
      this.onSubmit(null);
    }
    this.contentEl.empty();
  }

  private submit(): void {
    this.hasSubmitted = true;
    this.onSubmit(this.apiKey || null);
    this.close();
  }
}

const requestAnthropicApiKey = (app: App): Promise<string | null> =>
  new Promise((resolve) => {
    new AnthropicApiKeyModal(app, resolve).open();
  });

class PaperRelationsDebugModal extends Modal {
  private nodes: CreatedPaperNode[];
  private onRun: () => void;

  constructor(app: App, nodes: CreatedPaperNode[], onRun: () => void) {
    super(app);
    this.nodes = nodes;
    this.onRun = onRun;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Debug paper relation extraction" });
    contentEl.createEl("p", {
      text: `Found ${this.nodes.length} generated node(s) for the current paper. These nodes will be sent to the relation extraction call.`,
    });

    const list = contentEl.createEl("ul");
    this.nodes.forEach(({ extractedNode, file }) => {
      const item = list.createEl("li");
      item.createEl("strong", {
        text: `${extractedNode.id} ${extractedNode.nodeTypeConfig.name}`,
      });
      item.createEl("div", { text: extractedNode.content });
      item.createEl("small", { text: file.path });
    });

    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
    });

    buttonContainer
      .createEl("button", {
        text: "Cancel",
        cls: "mod-normal",
      })
      .addEventListener("click", () => this.close());

    buttonContainer
      .createEl("button", {
        text: "Run relation extraction",
        cls: "mod-cta",
      })
      .addEventListener("click", () => {
        this.close();
        this.onRun();
      });
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

export const createModifyNodeModalSubmitHandler = (
  plugin: DiscourseGraphPlugin,
  editor?: Editor,
): ((params: ModifyNodeSubmitParams) => Promise<void>) => {
  return async ({
    nodeType,
    title,
    selectedExistingNode,
    relationshipId,
    relationshipTargetFile,
  }: ModifyNodeSubmitParams) => {
    if (selectedExistingNode) {
      if (editor && editor.somethingSelected()) {
        editor?.replaceSelection(`[[${selectedExistingNode.basename}]]`);
      }
      await addRelationIfRequested(plugin, selectedExistingNode, {
        relationshipId,
        relationshipTargetFile,
      });
    } else {
      const newFile = await createDiscourseNode({
        plugin,
        nodeType,
        text: title,
        editor,
      });
      if (newFile) {
        await addRelationIfRequested(plugin, newFile, {
          relationshipId,
          relationshipTargetFile,
        });
      }
    }
  };
};

export const registerCommands = (plugin: DiscourseGraphPlugin) => {
  plugin.addCommand({
    id: "create-discourse-node",
    name: "Create discourse node",
    callback: () => {
      const currentFile =
        plugin.app.workspace.getActiveViewOfType(MarkdownView)?.file ||
        undefined;
      const editor =
        plugin.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
      new ModifyNodeModal(plugin.app, {
        nodeTypes: plugin.settings.nodeTypes,
        plugin,
        currentFile,
        onSubmit: createModifyNodeModalSubmitHandler(plugin, editor),
      }).open();
    },
  });

  plugin.addCommand({
    id: "bulk-identify-discourse-nodes",
    name: "Bulk identify discourse nodes",
    callback: () => {
      new BulkIdentifyDiscourseNodesModal(plugin.app, plugin).open();
    },
  });

  plugin.addCommand({
    id: "import-nodes-from-another-space",
    name: "Import nodes from another space",
    checkCallback: (checking: boolean) => {
      if (!plugin.settings.syncModeEnabled) {
        if (!checking) {
          new Notice("Sync mode is not enabled", 3000);
        }
        return false;
      }
      if (!checking) {
        new ImportNodesModal(plugin.app, plugin).open();
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "refresh-imported-nodes",
    name: "Fetch latest content from imported nodes",
    checkCallback: (checking: boolean) => {
      if (!plugin.settings.syncModeEnabled) {
        if (!checking) {
          new Notice("Sync mode is not enabled", 3000);
        }
        return false;
      }
      if (!checking) {
        void refreshAllImportedFiles(plugin)
          .then((result) => {
            if (result.failed > 0) {
              new Notice(
                `Refresh completed with some issues:\n${result.success} file(s) refreshed successfully\n${result.failed} file(s) failed`,
                5000,
              );
              if (result.errors.length > 0) {
                console.error("Refresh errors:", result.errors);
              }
            } else if (result.success > 0) {
              new Notice(
                `Successfully refreshed ${result.success} imported node(s)`,
                3000,
              );
            } else {
              new Notice("No imported files found to refresh", 3000);
            }
          })
          .catch((error) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            new Notice(`Refresh failed: ${errorMessage}`, 5000);
            console.error("Refresh failed:", error);
          });
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "toggle-discourse-context",
    name: "Toggle discourse context",
    callback: () => {
      plugin.toggleDiscourseContextView();
    },
  });

  plugin.addCommand({
    id: "open-discourse-graph-settings",
    name: "Open Discourse Graphs settings",
    callback: () => {
      // plugin.app.setting is an unofficial API
      const setting = (
        plugin.app as unknown as {
          setting: {
            open: () => void;
            openTabById: (id: string) => void;
          };
        }
      ).setting;
      setting.open();
      setting.openTabById(plugin.manifest.id);
    },
  });

  plugin.addCommand({
    id: "switch-to-tldraw-edit",
    name: "Switch to discourse markdown edit",
    checkCallback: (checking: boolean) => {
      const leaf = plugin.app.workspace.getActiveViewOfType(TldrawView)?.leaf;
      if (!leaf) return false;

      if (!checking) {
        void leaf.setViewState({
          type: VIEW_TYPE_MARKDOWN,
          state: leaf.view.getState(),
        });
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "switch-to-tldraw-preview",
    name: "Switch to Discourse Graph canvas view",
    checkCallback: (checking: boolean) => {
      const leaf = plugin.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
      if (!leaf) return false;

      if (!checking) {
        void leaf.setViewState({
          type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
          state: leaf.view.getState(),
        });
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "create-discourse-graph-canvas",
    name: "Create new Discourse Graph canvas",
    icon: "layout-dashboard", // Using Lucide icon as per style guide
    callback: () => createCanvas(plugin),
  });

  plugin.addCommand({
    id: "create-paper-discourse-nodes",
    name: "Create paper discourse nodes from current note",
    checkCallback: (checking: boolean) => {
      const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      const sourceFile = activeView?.file;
      if (!activeView || !sourceFile) return false;

      if (!checking) {
        const selectedText = activeView.editor.getSelection().trim();
        void (async () => {
          try {
            const markdown =
              selectedText || (await plugin.app.vault.read(sourceFile));
            if (!markdown.trim()) {
              new Notice("No paper content found in the current note", 3000);
              return;
            }

            const apiKey = await requestAnthropicApiKey(plugin.app);
            if (!apiKey) {
              new Notice("Paper graph extraction cancelled", 3000);
              return;
            }

            await createPaperDiscourseNodesFromMarkdown({
              plugin,
              markdown,
              apiKey,
              sourceFile,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            new Notice(`Paper graph extraction failed: ${message}`, 8000);
            console.error("Paper graph extraction failed:", error);
          }
        })();
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "debug-extract-paper-relations",
    name: "Debug: extract paper relations for current note",
    checkCallback: (checking: boolean) => {
      const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      const sourceFile = activeView?.file;
      if (!sourceFile) return false;

      if (!checking) {
        void (async () => {
          try {
            const existingNodes = await findExistingPaperNodesForSourceFile({
              plugin,
              sourceFile,
            });

            if (existingNodes.length === 0) {
              new Notice(
                "No generated discourse nodes found for the current note",
                5000,
              );
              return;
            }

            new PaperRelationsDebugModal(plugin.app, existingNodes, () => {
              void (async () => {
                try {
                  const apiKey = await requestAnthropicApiKey(plugin.app);
                  if (!apiKey) {
                    new Notice("Paper relation extraction cancelled", 3000);
                    return;
                  }

                  const result = await extractPaperRelationsForExistingNodes({
                    plugin,
                    sourceFile,
                    apiKey,
                  });

                  new Notice(
                    `Extracted ${result.normalizedGraph.relations.length} valid relation(s), persisted ${result.persistedRelations.length}, skipped ${result.normalizedGraph.skippedRelations.length}. See console for details.`,
                    7000,
                  );
                } catch (error) {
                  const message =
                    error instanceof Error ? error.message : String(error);
                  new Notice(
                    `Paper relation extraction failed: ${message}`,
                    8000,
                  );
                  console.error("Paper relation extraction failed:", error);
                }
              })();
            }).open();
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            new Notice(
              `Could not inspect generated paper nodes: ${message}`,
              8000,
            );
            console.error("Could not inspect generated paper nodes:", error);
          }
        })();
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "debug-create-paper-graph-canvas",
    name: "Debug: create paper graph canvas for current note",
    checkCallback: (checking: boolean) => {
      const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      const sourceFile = activeView?.file;
      if (!sourceFile) return false;

      if (!checking) {
        void (async () => {
          try {
            const canvasFile = await createPaperGraphCanvasFromCurrentNote({
              plugin,
              sourceFile,
            });
            if (!canvasFile) return;
            console.log("Debug paper graph canvas created", {
              sourceFile: sourceFile.path,
              canvasFile: canvasFile.path,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            new Notice(`Could not create paper graph canvas: ${message}`, 8000);
            console.error("Could not create paper graph canvas:", error);
          }
        })();
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "debug-create-organic-paper-graph-canvas",
    name: "Debug: create organic paper graph canvas for current note",
    checkCallback: (checking: boolean) => {
      const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      const sourceFile = activeView?.file;
      if (!sourceFile) return false;

      if (!checking) {
        void (async () => {
          try {
            const canvasFile = await createPaperGraphCanvasFromCurrentNote({
              plugin,
              sourceFile,
              layoutMode: "force",
            });
            if (!canvasFile) return;
            console.log("Debug organic paper graph canvas created", {
              sourceFile: sourceFile.path,
              canvasFile: canvasFile.path,
            });
          } catch (error) {
            const message =
              error instanceof Error ? error.message : String(error);
            new Notice(
              `Could not create organic paper graph canvas: ${message}`,
              8000,
            );
            console.error(
              "Could not create organic paper graph canvas:",
              error,
            );
          }
        })();
      }
      return true;
    },
  });

  plugin.addCommand({
    id: "sync-discourse-nodes-to-supabase",
    name: "Sync discourse nodes to Supabase",
    checkCallback: (checking: boolean) => {
      if (!plugin.settings.syncModeEnabled) {
        if (!checking) {
          new Notice("Sync mode is not enabled", 3000);
        }
        return false;
      }
      if (!checking) {
        void syncAllNodesAndRelations(plugin)
          .then(() => {
            new Notice("Discourse nodes synced successfully", 3000);
          })
          .catch((error) => {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            new Notice(`Sync failed: ${errorMessage}`, 5000);
            console.error("Manual sync failed:", error);
          });
      }
      return true;
    },
  });
  plugin.addCommand({
    id: "create-base-for-node-type",
    name: "Create Base view for node type",
    callback: () => {
      new NodeTypeModal(plugin, (nodeType) => {
        void createBaseForNodeType(plugin, nodeType);
      }).open();
    },
  });

  plugin.addCommand({
    id: "publish-discourse-node",
    name: "Publish current node to lab space",
    checkCallback: (checking: boolean) => {
      if (!plugin.settings.syncModeEnabled) {
        if (!checking) {
          new Notice("Sync mode is not enabled", 3000);
        }
        return false;
      }
      const activeView = plugin.app.workspace.getActiveViewOfType(MarkdownView);
      if (!activeView || !activeView.file) {
        return false;
      }
      const file = activeView.file;
      const cache = plugin.app.metadataCache.getFileCache(file);
      const frontmatter = cache?.frontmatter || {};
      if (!frontmatter.nodeTypeId) {
        return false;
      }
      if (!checking) {
        if (!frontmatter.nodeInstanceId) {
          new Notice("Please sync the node first");
          return true;
        }
        // TODO (in follow-up PRs):
        // Maybe sync the node now if unsynced
        // Ensure that the node schema is synced to the database, and shared
        // sync the assets to the database
        publishNode({ plugin, file, frontmatter })
          .then(() => {
            new Notice("Published");
          })
          .catch((error: Error) => {
            new Notice(error.message);
            console.error(error);
          });
      }
      return true;
    },
  });
};
