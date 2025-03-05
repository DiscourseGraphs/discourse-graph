import { StrictMode, useState, useEffect } from "react";
import { App, PluginSettingTab, Notice } from "obsidian";
import type DiscourseGraphPlugin from "../index";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider, useApp } from "./AppContext";
import RelationshipTypeSettings from "./RelationshipTypeSettings";
import RelationshipSettings from "./RelationshipSettings";
import NodeTypeSettings from "./NodeTypeSettings";
import React from "react";

const Settings = ({ plugin }: { plugin: DiscourseGraphPlugin }) => {
  const [activeTab, setActiveTab] = useState("nodeTypes");

  return (
    <div>
      <h2>Discourse Graph Settings</h2>

      <div
        className="discourse-tabs"
        style={{
          marginBottom: "20px",
          borderBottom: "1px solid var(--background-modifier-border)",
        }}
      >
        <button
          onClick={() => setActiveTab("nodeTypes")}
          className={`discourse-tab ${activeTab === "nodeTypes" ? "active" : ""}`}
          style={{
            padding: "8px 16px",
            background:
              activeTab === "nodeTypes"
                ? "var(--background-modifier-hover)"
                : "transparent",
            border: "none",
            borderBottom:
              activeTab === "nodeTypes"
                ? "2px solid var(--interactive-accent)"
                : "none",
            marginRight: "8px",
            cursor: "pointer",
          }}
        >
          Node Types
        </button>
        <button
          onClick={() => setActiveTab("relationTypes")}
          className={`discourse-tab ${activeTab === "relationTypes" ? "active" : ""}`}
          style={{
            padding: "8px 16px",
            background:
              activeTab === "relationTypes"
                ? "var(--background-modifier-hover)"
                : "transparent",
            border: "none",
            borderBottom:
              activeTab === "relationTypes"
                ? "2px solid var(--interactive-accent)"
                : "none",
            marginRight: "8px",
            cursor: "pointer",
          }}
        >
          Relation Types
        </button>
        <button
          onClick={() => setActiveTab("relations")}
          className={`discourse-tab ${activeTab === "relations" ? "active" : ""}`}
          style={{
            padding: "8px 16px",
            background:
              activeTab === "relations"
                ? "var(--background-modifier-hover)"
                : "transparent",
            border: "none",
            borderBottom:
              activeTab === "relations"
                ? "2px solid var(--interactive-accent)"
                : "none",
            cursor: "pointer",
          }}
        >
          Discourse Relations
        </button>
      </div>

      {activeTab === "nodeTypes" && <NodeTypeSettings plugin={plugin} />}
      {activeTab === "relationTypes" && (
        <RelationshipTypeSettings plugin={plugin} />
      )}
      {activeTab === "relations" && <RelationshipSettings plugin={plugin} />}
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
          <Settings plugin={this.plugin} />
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