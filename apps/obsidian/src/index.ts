import { Plugin } from "obsidian";
import { registerCommands } from "~/utils/registerCommands";
import { SettingsTab } from "~/components/Settings";

type Settings = {
  mySetting: string;
};

const DEFAULT_SETTINGS: Settings = {
  mySetting: "default",
};

export default class DiscourseGraphPlugin extends Plugin {
  settings: Settings = { mySetting: "default" };

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
