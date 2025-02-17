import { Plugin } from "obsidian";
import { registerCommands } from "~/utils/registerCommands";
import { SettingsTab } from "~/components/Settings";
import { DiscourseNodeType } from "./types";

type Settings = {
  mySetting: string;
  nodeTypes: DiscourseNodeType[];
};

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
};

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { mySetting: "default", nodeTypes: [] };

  async onload() {
    await this.loadSettings();
    console.log("DiscourseGraphPlugin loaded");
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
