import {
  Plugin,
  Editor,
  Menu,
  TFile,
  Events,
  MarkdownView,
  ViewState,
  WorkspaceLeaf,
  App,
} from "obsidian";
import { SettingsTab } from "~/components/Settings";
import { Settings } from "~/types";
import { registerCommands } from "~/utils/registerCommands";
import { DiscourseContextView } from "~/components/DiscourseContextView";
import {
  VIEW_TYPE_DISCOURSE_CONTEXT,
  VIEW_TYPE_TLDRAW_DG,
  VIEW_TYPE_TLDRAW_DG_PREVIEW,
  FRONTMATTER_KEY,
} from "~/constants";
import {
  convertPageToDiscourseNode,
  createDiscourseNode,
} from "~/utils/createNode";
import { DEFAULT_SETTINGS } from "~/constants";
import { CreateNodeModal } from "~/components/CreateNodeModal";
import { around } from "monkey-around";
import { TldrawView } from "~/components/TldrawView";
import { TldrawPreview } from "~/components/TldrawPreview";

declare global {
  interface Window {
    app: App;
  }
}

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = DEFAULT_SETTINGS;
  private styleElement: HTMLStyleElement | null = null;

  async onload() {
    await this.loadSettings();
    registerCommands(this);
    this.addSettingTab(new SettingsTab(this.app, this));

    this.registerView(
      VIEW_TYPE_DISCOURSE_CONTEXT,
      (leaf) => new DiscourseContextView(leaf, this),
    );

    this.addRibbonIcon("telescope", "Toggle Discourse Context", () => {
      this.toggleDiscourseContextView();
    });

    // Initialize frontmatter CSS
    this.updateFrontmatterStyles();

    // Register views
    this.registerView(
      VIEW_TYPE_TLDRAW_DG,
      (leaf) => new TldrawView(leaf, this),
    );

    this.registerView(
      VIEW_TYPE_TLDRAW_DG_PREVIEW,
      (leaf) => new TldrawPreview(leaf, this),
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
                      onNodeCreate: async (nodeType, title) => {
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

    // Register event to intercept view changes
    this.register(
      around(WorkspaceLeaf.prototype, {
        setViewState(next: Function) {
          return async function (
            this: WorkspaceLeaf,
            state: ViewState,
            ...rest: any[]
          ) {
            // Only intercept markdown view state changes
            if (state.type === "markdown") {
              const view = this.view as MarkdownView;
              const file = view?.file;
              if (file instanceof TFile) {
                // Check frontmatter for our key
                const fcache = window.app.metadataCache.getFileCache(file);
                const frontmatter = fcache?.frontmatter;

                if (frontmatter && frontmatter[FRONTMATTER_KEY]) {
                  // For new files or files being opened, default to preview mode
                  const newState = {
                    type: VIEW_TYPE_TLDRAW_DG_PREVIEW,
                    state: {
                      ...state.state,
                      file: file.path,
                      mode: "preview",
                    },
                  };
                  return next.apply(this, [newState, ...rest]);
                }
              }
            }

            return next.apply(this, [state, ...rest]);
          };
        },
      }),
    );

    // Switch existing files to tldraw view if needed
    this.app.workspace.onLayoutReady(() => {
      for (let leaf of this.app.workspace.getLeavesOfType("markdown")) {
        if (leaf.view instanceof MarkdownView && leaf.view.file) {
          const fcache = this.app.metadataCache.getFileCache(leaf.view.file);
          const frontmatter = fcache?.frontmatter;

          if (frontmatter && frontmatter[FRONTMATTER_KEY]) {
            // Switch to appropriate view based on current mode
            const viewType =
              leaf.getViewState().state?.mode === "preview"
                ? VIEW_TYPE_TLDRAW_DG_PREVIEW
                : VIEW_TYPE_TLDRAW_DG;

            leaf.setViewState({
              type: viewType,
              state: leaf.view.getState(),
            });
          }
        }
      }
    });
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

  async onunload() {
    if (this.styleElement) {
      this.styleElement.remove();
    }

    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DISCOURSE_CONTEXT);
  }
}
