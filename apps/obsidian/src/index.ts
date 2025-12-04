/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Plugin,
  Editor,
  Menu,
  TFile,
  MarkdownView,
  WorkspaceLeaf,
} from "obsidian";
import { EditorView } from "@codemirror/view";
import { SettingsTab } from "~/components/Settings";
import { Settings, VIEW_TYPE_DISCOURSE_CONTEXT } from "~/types";
import { registerCommands } from "~/utils/registerCommands";
import { DiscourseContextView } from "~/components/DiscourseContextView";
import { VIEW_TYPE_TLDRAW_DG_PREVIEW, FRONTMATTER_KEY } from "~/constants";
import {
  convertPageToDiscourseNode,
  createDiscourseNode,
} from "~/utils/createNode";
import { DEFAULT_SETTINGS } from "~/constants";
import { CreateNodeModal } from "~/components/CreateNodeModal";
import { TagNodeHandler } from "~/utils/tagNodeHandler";
import { TldrawView } from "~/components/canvas/TldrawView";
import { NodeTagSuggestPopover } from "~/components/NodeTagSuggestModal";

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
  private styleElement: HTMLStyleElement | null = null;
  private tagNodeHandler: TagNodeHandler | null = null;
  private currentViewActions: { leaf: WorkspaceLeaf; action: any }[] = [];

  async onload() {
    await this.loadSettings();
    registerCommands(this);
    this.addSettingTab(new SettingsTab(this.app, this));

    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        (leaf: WorkspaceLeaf | null) => {
          this.cleanupViewActions();

          if (!leaf) return;

          const view = leaf.view;
          if (!(view instanceof MarkdownView)) return;

          const file = view.file;
          if (!file) return;

          const cache = this.app.metadataCache.getFileCache(file);
          if (cache?.frontmatter?.[FRONTMATTER_KEY]) {
            // Add new action and track it
            const action = view.addAction(
              "layout",
              "View as canvas",
              async () => {
                await leaf.setViewState({
                  type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
                  state: view.getState(),
                });
              },
            );

            this.currentViewActions.push({ leaf, action });
          }
        },
      ),
    );

    this.registerEvent(
      this.app.workspace.on("file-open", (file: TFile | null) => {
        if (!file) return;

        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter?.[FRONTMATTER_KEY]) {
          const leaf =
            this.app.workspace.getActiveViewOfType(MarkdownView)?.leaf;
          if (leaf) {
            void leaf.setViewState({
              type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
              state: leaf.view.getState(),
            });
          }
        }
      }),
    );

    this.registerView(
      VIEW_TYPE_DISCOURSE_CONTEXT,
      (leaf) => new DiscourseContextView(leaf, this),
    );

    this.addRibbonIcon("telescope", "Toggle Discourse Context", () => {
      this.toggleDiscourseContextView();
    });

    // Initialize frontmatter CSS
    this.updateFrontmatterStyles();

    // Initialize tag node handler
    try {
      this.tagNodeHandler = new TagNodeHandler(this);
      this.tagNodeHandler.initialize();
    } catch (error) {
      console.error("Failed to initialize TagNodeHandler:", error);
      this.tagNodeHandler = null;
    }
    this.registerView(
      VIEW_TYPE_TLDRAW_DG_PREVIEW,
      (leaf) => new TldrawView(leaf, this),
    );

    this.registerEvent(
      // @ts-ignore - file-menu event exists but is not in the type definitions
      this.app.workspace.on("file-menu", (menu: Menu, file: TFile) => {
        const fileCache = this.app.metadataCache.getFileCache(file);
        const fileNodeType = fileCache?.frontmatter?.nodeTypeId;

        if (
          !fileNodeType ||
          !this.settings.nodeTypes.some(
            (nodeType) => nodeType.id === fileNodeType,
          )
        ) {
          menu.addItem((menuItem) => {
            menuItem.setTitle("Convert into");
            menuItem.setIcon("file-type");

            // @ts-ignore - setSubmenu is not officially in the API but works
            const submenu = menuItem.setSubmenu();

            this.settings.nodeTypes.forEach((nodeType) => {
              submenu.addItem((item: any) => {
                item
                  .setTitle(nodeType.name)
                  .setIcon("file-type")
                  .onClick(() => {
                    new CreateNodeModal(this.app, {
                      nodeTypes: this.settings.nodeTypes,
                      plugin: this,
                      initialTitle: file.basename,
                      initialNodeType: nodeType,
                      onSubmit: async ({ nodeType, title }) => {
                        await convertPageToDiscourseNode({
                          plugin: this,
                          file,
                          nodeType,
                          title,
                        });
                      },
                    }).open();
                  });
              });
            });
          });
        }
      }),
    );

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu: Menu, editor: Editor) => {
        if (!editor.getSelection()) return;

        menu.addItem((menuItem) => {
          menuItem.setTitle("Turn into Discourse Node");
          menuItem.setIcon("file-type");

          // Create submenu using the unofficial API pattern
          // @ts-ignore - setSubmenu is not officially in the API but works
          const submenu = menuItem.setSubmenu();

          this.settings.nodeTypes.forEach((nodeType) => {
            submenu.addItem((item: any) => {
              item
                .setTitle(nodeType.name)
                .setIcon("file-type")
                .onClick(async () => {
                  await createDiscourseNode({
                    plugin: this,
                    editor,
                    nodeType,
                    text: editor.getSelection().trim() || "",
                  });
                });
            });
          });
        });
      }),
    );

    // Register editor keydown listener for node tag hotkey
    this.setupNodeTagHotkey();
  }

  private setupNodeTagHotkey() {
    const nodeTagHotkeyExtension = EditorView.domEventHandlers({
      keydown: (event: KeyboardEvent) => {
        // Access settings dynamically to handle changes
        const hotkey = this.settings.nodeTagHotkey;

        if (!hotkey || event.key !== hotkey) {
          return false;
        }
        event.preventDefault();
        event.stopPropagation();

        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView?.editor) {
          // Open the node tag suggest popover
          const popover = new NodeTagSuggestPopover(
            activeView.editor,
            this.settings.nodeTypes,
          );
          popover.open();
        }

        return true;
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    this.registerEditorExtension(nodeTagHotkeyExtension);
  }

  private createStyleElement() {
    if (!this.styleElement) {
      this.styleElement = document.createElement("style");
      this.styleElement.id = "discourse-graph-frontmatter-styles";
      document.head.appendChild(this.styleElement);
    }
  }

  updateFrontmatterStyles() {
    try {
      this.createStyleElement();

      let keysToHide: string[] = [];

      if (!this.settings.showIdsInFrontmatter) {
        keysToHide.push("nodeTypeId");
        keysToHide.push(...this.settings.relationTypes.map((rt) => rt.id));
      }

      if (keysToHide.length > 0) {
        const selectors = keysToHide
          .map((key) => `.metadata-property[data-property-key="${key}"]`)
          .join(", ");

        this.styleElement!.textContent = `${selectors} { display: none !important; }`;
      } else {
        this.styleElement!.textContent = "";
      }
    } catch (error) {
      console.error("Error updating frontmatter styles:", error);
    }
  }

  toggleDiscourseContextView() {
    const { workspace } = this.app;
    const existingLeaf = workspace.getLeavesOfType(
      VIEW_TYPE_DISCOURSE_CONTEXT,
    )[0];

    if (existingLeaf) {
      existingLeaf.detach();
    } else {
      const activeFile = workspace.getActiveFile();
      const leaf = workspace.getRightLeaf(false);
      if (leaf) {
        const layoutChangeHandler = () => {
          const view = leaf.view;
          if (view instanceof DiscourseContextView) {
            view.setActiveFile(activeFile);
            workspace.off("layout-change", layoutChangeHandler);
          }
        };

        workspace.on("layout-change", layoutChangeHandler);

        leaf.setViewState({
          type: VIEW_TYPE_DISCOURSE_CONTEXT,
          active: true,
        });
        workspace.revealLeaf(leaf);
      }
    }
  }

  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

    if (!loadedData || this.hasNewFields(loadedData)) {
      await this.saveSettings();
    } else {
      this.updateFrontmatterStyles();
    }
  }

  private hasNewFields(loadedData: any): boolean {
    return Object.keys(DEFAULT_SETTINGS).some((key) => !(key in loadedData));
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.updateFrontmatterStyles();
  }

  private cleanupViewActions() {
    this.currentViewActions.forEach(({ leaf, action }) => {
      try {
        if (leaf?.view) {
          if (action?.remove) {
            action.remove();
          } else if (action?.detach) {
            action.detach();
          }
        }
      } catch (e) {
        console.error("Failed to cleanup view action:", e);
      }
    });
    this.currentViewActions = [];
  }

  async onunload() {
    this.cleanupViewActions();
    if (this.styleElement) {
      this.styleElement.remove();
    }

    if (this.tagNodeHandler) {
      this.tagNodeHandler.cleanup();
      this.tagNodeHandler = null;
    }

    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DISCOURSE_CONTEXT);
  }
}
