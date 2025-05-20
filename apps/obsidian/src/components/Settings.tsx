import { StrictMode, useState } from "react";
import { App, PluginSettingTab } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider } from "./AppContext";
import RelationshipTypeSettings from "./RelationshipTypeSettings";
import RelationshipSettings from "./RelationshipSettings";
import NodeTypeSettings from "./NodeTypeSettings";
import FrontmatterSettings from "./FrontmatterSettings";
import { PluginProvider } from "./PluginContext";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("nodeTypes");

  return (
    <div className="flex flex-col">
      <h2 className="dg-h2">Discourse Graph Settings</h2>

      <div className="border-modifier-border border-b p-2">
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
        <button
          onClick={() => setActiveTab("frontmatter")}
          className={`cursor-pointer px-4 py-2 ${
            activeTab === "frontmatter"
              ? "!bg-modifier-hover accent-border-bottom"
              : "!bg-transparent"
          }`}
        >
          Frontmatter
        </button>
      </div>

      {activeTab === "nodeTypes" && <NodeTypeSettings />}
      {activeTab === "relationTypes" && <RelationshipTypeSettings />}
      {activeTab === "relations" && <RelationshipSettings />}
      {activeTab === "frontmatter" && <FrontmatterSettings />}
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
