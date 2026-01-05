import { StrictMode } from "react";
import { App, Modal } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import { ContextProvider } from "./AppContext";
import { PluginProvider } from "./PluginContext";
import { FeatureFlagSettings } from "./FeatureFlagSettings";

export class FeatureFlagModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle("Feature Flag Settings");

    const settingsComponentEl = contentEl.createDiv();
    this.root = createRoot(settingsComponentEl);
    this.root.render(
      <StrictMode>
        <ContextProvider app={this.app}>
          <PluginProvider plugin={this.plugin}>
            <FeatureFlagSettings />
          </PluginProvider>
        </ContextProvider>
      </StrictMode>,
    );
  }

  onClose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    const { contentEl } = this;
    contentEl.empty();
  }
}
