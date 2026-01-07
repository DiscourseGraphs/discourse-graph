import { StrictMode, useState, useEffect } from "react";
import { App, PluginSettingTab } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider } from "./AppContext";
import RelationshipTypeSettings from "./RelationshipTypeSettings";
import RelationshipSettings from "./RelationshipSettings";
import NodeTypeSettings from "./NodeTypeSettings";
import GeneralSettings from "./GeneralSettings";
import { AdminPanelSettings } from "./AdminPanelSettings";
import { PluginProvider } from "./PluginContext";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("general");

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.shiftKey && e.key.toLowerCase() === "a") {
        e.stopPropagation();
        e.preventDefault();
        setActiveTab("admin-panel");
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="dg-h2">Discourse Graph Settings</h2>
      <div className="border-modifier-border flex w-full overflow-x-auto border-b p-2">
        <button
          onClick={() => setActiveTab("general")}
          className={`discourse-tab mr-2 cursor-pointer border-0 px-4 py-2 ${
            activeTab === "general"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab("nodeTypes")}
          className={`discourse-tab mr-2 cursor-pointer border-0 px-4 py-2 ${
            activeTab === "nodeTypes"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          Node Types
        </button>
        <button
          onClick={() => setActiveTab("relationTypes")}
          className={`mr-2 cursor-pointer px-4 py-2 ${
            activeTab === "relationTypes"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          Relation Types
        </button>
        <button
          onClick={() => setActiveTab("relations")}
          className={`mr-2 cursor-pointer px-4 py-2 ${
            activeTab === "relations"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          Discourse Relations
        </button>
        {/* Hidden Admin Panel tab - only visible when activeTab is "admin-panel" */}
        {activeTab === "admin-panel" && (
          <button className="!bg-modifier-hover accent-border-bottom mr-2 cursor-pointer border-0 px-4 py-2">
            Admin Panel
          </button>
        )}
      </div>

      {activeTab === "general" && <GeneralSettings />}
      {activeTab === "nodeTypes" && <NodeTypeSettings />}
      {activeTab === "relationTypes" && <RelationshipTypeSettings />}
      {activeTab === "relations" && <RelationshipSettings />}
      {activeTab === "frontmatter" && <GeneralSettings />}
      {activeTab === "admin-panel" && <AdminPanelSettings />}
    </div>
  );
};

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
    const settingsComponentEl = containerEl.createDiv();
    this.root = createRoot(settingsComponentEl);
    this.root.render(
      <StrictMode>
        <ContextProvider app={this.app}>
          <PluginProvider plugin={this.plugin}>
            <Settings />
          </PluginProvider>
        </ContextProvider>
      </StrictMode>,
    );
  }

  hide(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
