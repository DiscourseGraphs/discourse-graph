import { Plugin, Editor, Menu, Notice, TFile } from "obsidian";
import { SettingsTab } from "~/components/Settings";
import { Settings } from "~/types";
import { registerCommands } from "~/utils/registerCommands";
import { DiscourseContextView } from "~/components/DiscourseContextView";
import { VIEW_TYPE_DISCOURSE_CONTEXT, DiscourseNode } from "~/types";
import { getDiscourseNodeFormatExpression } from "~/utils/getDiscourseNodeFormatExpression";
import { checkInvalidChars } from "~/utils/validateNodeType";
import { processTextToDiscourseNode } from "./utils/createNodeFromSelectedText";

const DEFAULT_SETTINGS: Settings = {
  nodeTypes: [],
  discourseRelations: [],
  relationTypes: [],
};

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };

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
                  await processTextToDiscourseNode(this.app, editor, nodeType);
                });
            });
          });
        });
      }),
    );
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_DISCOURSE_CONTEXT);
  }
}
