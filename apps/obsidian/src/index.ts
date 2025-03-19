import { Plugin, Notice, WorkspaceLeaf } from "obsidian";
import { SettingsTab } from "./components/Settings";
import { Settings } from "./types";
import { registerCommands } from "./utils/registerCommands";
import {
  DiscourseContextView,
  VIEW_TYPE_DISCOURSE_CONTEXT,
} from "./components/DiscourseContextView";

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

    // Register the Discourse Context view
    this.registerView(
      VIEW_TYPE_DISCOURSE_CONTEXT,
      (leaf) => new DiscourseContextView(leaf, this),
    );

    // Add a ribbon icon to toggle the view
    this.addRibbonIcon("network", "Toggle Discourse Context", () => {
      this.toggleDiscourseContextView();
    });

    // Open the view when the plugin loads
    this.app.workspace.onLayoutReady(() => {
      this.toggleDiscourseContextView();
    });
  }

  toggleDiscourseContextView() {
    const { workspace } = this.app;
    const existingLeaf = workspace.getLeavesOfType(
      VIEW_TYPE_DISCOURSE_CONTEXT,
    )[0];

    if (existingLeaf) {
      // If it's already open, close it
      existingLeaf.detach();
    } else {
      // Open it in the right sidebar
      const leaf = workspace.getRightLeaf(false);
      if (leaf) {
        leaf.setViewState({
          type: VIEW_TYPE_DISCOURSE_CONTEXT,
          active: true,
        });
        workspace.revealLeaf(leaf);

        // Give a small delay to ensure the view is properly initialized
        setTimeout(() => {
          // Try to get the view instance
          const view = leaf.view;
          if (view instanceof DiscourseContextView) {
            // Force an update with the current active file
            view.setActiveFile(workspace.getActiveFile());
          }
        }, 50);
      }
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
