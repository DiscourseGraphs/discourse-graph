import { App, PluginSettingTab, Setting } from "obsidian";
import DiscourseGraphPlugin from "../index";

export class SettingsTab extends PluginSettingTab {
  plugin: DiscourseGraphPlugin;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Discourse Graph Settings" });
    containerEl.createEl("h3", { text: "Node Types" });

    this.plugin.settings.nodeTypes.forEach((nodeType, index) => {
      new Setting(containerEl)
        .setName(`Node Type ${index + 1}`)
        .addText((text) =>
          text
            .setPlaceholder("Name")
            .setValue(nodeType.name)
            .onChange(async (value) => {
              this.plugin.settings.nodeTypes[index].name = value;
              await this.plugin.saveSettings();
            }),
        )
        .addText((text) =>
          text
            .setPlaceholder("Format (e.g., [[CLM]] - {content})")
            .setValue(nodeType.format)
            .onChange(async (value) => {
              this.plugin.settings.nodeTypes[index].format = value;
              await this.plugin.saveSettings();
            }),
        );
    });

    new Setting(containerEl).addButton((btn) =>
      btn.setButtonText("Add Node Type").onClick(async () => {
        this.plugin.settings.nodeTypes.push({
          name: "",
          format: "",
        });
        await this.plugin.saveSettings();
        this.display();
      }),
    );
  }
}
