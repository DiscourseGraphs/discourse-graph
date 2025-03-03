import { Plugin } from "obsidian";
import { SettingsTab } from "~/components/Settings";
import { Settings } from "./types";
import { registerCommands } from "./utils/registerCommands";

const DEFAULT_SETTINGS: Settings = {
  nodeTypes: [],
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
