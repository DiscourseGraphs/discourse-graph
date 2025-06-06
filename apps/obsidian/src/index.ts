import { Plugin, Editor, Menu } from "obsidian";
import { SettingsTab } from "~/components/Settings";
import { Settings } from "~/types";
import { registerCommands } from "~/utils/registerCommands";
import { DiscourseContextView } from "~/components/DiscourseContextView";
import { VIEW_TYPE_DISCOURSE_CONTEXT } from "~/types";
import { processTextToDiscourseNode } from "./utils/createNode";
import { DEFAULT_SETTINGS } from "./constants";

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };
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
                  await processTextToDiscourseNode({
                    plugin: this,
                    editor,
                    nodeType,
                  });
                });
            });
          });
        });
      }),
    );
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
