import { App, Modal } from "obsidian";
import { Root, createRoot } from "react-dom/client";
import type DiscourseGraphPlugin from "~/index";
import { ContextProvider } from "./AppContext";
import { PluginProvider } from "./PluginContext";
import { AdminPanelSettings } from "./AdminPanelSettings";
import { StrictMode } from "react";

export class AdminPanelModal extends Modal {
  private plugin: DiscourseGraphPlugin;
  private root: Root | null = null;

  constructor(app: App, plugin: DiscourseGraphPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    this.setTitle("Admin Panel");

    const settingsComponentEl = contentEl.createDiv();
    this.root = createRoot(settingsComponentEl);
    this.root.render(
      <StrictMode>
        <ContextProvider app={this.app}>
          <PluginProvider plugin={this.plugin}>
            <AdminPanelSettings />
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
