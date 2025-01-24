import { StrictMode } from "react";
import { App, PluginSettingTab, Setting } from "obsidian";
import type DiscourseGraphPlugin from "../index";
import Settings from "./Settings";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider } from "./AppContext";

export class SettingsTab extends PluginSettingTab {
  root: Root | null = null;
  plugin: DiscourseGraphPlugin;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Example react component in settings
    const settingsComponentEl = containerEl.createDiv();
    this.root = createRoot(settingsComponentEl);
    this.root.render(
      <StrictMode>
        <ContextProvider app={this.app}>
          <Settings />
        </ContextProvider>
      </StrictMode>,
    );

    // Example obsidian settings
    const obsidianSettingsEl = containerEl.createDiv();
    new Setting(obsidianSettingsEl)
      .setName("Setting #1")
      .setDesc("It's a secret")
      .addText((text) =>
        text
          .setPlaceholder("Enter your secret")
          .setValue(this.plugin.settings.mySetting)
          .onChange(async (value) => {
            this.plugin.settings.mySetting = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}
