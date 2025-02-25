import { Plugin } from "obsidian";
import { registerCommands } from "~/utils/registerCommands";
import { SettingsTab } from "~/components/Settings";
import { Settings } from "./types";

const DEFAULT_SETTINGS: Settings = {
  mySetting: "default",
  nodeTypes: [
    {
      name: "Claim",
      format: "[[CLM]] - {content}",
      shortcut: "C",
      color: "#7DA13E",
    },
    {
      name: "Question",
      format: "[[QUE]] - {content}",
      shortcut: "Q",
      color: "#99890e",
    },
    {
      name: "Evidence",
      format: "[[EVD]] - {content}",
      shortcut: "E",
      color: "#DB134A",
    },
  ],
  nodeTypeHotkey: {
    modifiers: ["Mod", "Shift"],
    key: "Backslash",
  },
};

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { ...DEFAULT_SETTINGS };

  async onload() {
    await this.loadSettings();
    registerCommands(this);
    this.addSettingTab(new SettingsTab(this.app, this));
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}
