import { StrictMode, useState, useEffect } from "react";
import { App, PluginSettingTab, Setting } from "obsidian";
import type DiscourseGraphPlugin from "../index";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider, useApp } from "./AppContext";

const NodeTypeSettings = ({
  nodeTypes,
  onNodeTypeChange,
  onAddNodeType,
  onDeleteNodeType,
}: {
  nodeTypes: Array<{ name: string; format: string }>;
  onNodeTypeChange: (
    index: number,
    field: "name" | "format",
    value: string,
  ) => Promise<void>;
  onAddNodeType: () => Promise<void>;
  onDeleteNodeType: (index: number) => Promise<void>;
}) => {
  return (
    <div className="discourse-node-types">
      <h3>Node Types</h3>
      {nodeTypes.map((nodeType, index) => (
        <div key={index} className="setting-item">
          <div style={{ display: "flex", gap: "10px", width: "100%" }}>
            <input
              type="text"
              placeholder="Name"
              value={nodeType.name}
              onChange={(e) => onNodeTypeChange(index, "name", e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="text"
              placeholder="Format (e.g., [[CLM]] - {content})"
              value={nodeType.format}
              onChange={(e) =>
                onNodeTypeChange(index, "format", e.target.value)
              }
              style={{ flex: 2 }}
            />
            <button
              onClick={() => onDeleteNodeType(index)}
              className="mod-warning"
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      <div className="setting-item">
        <button onClick={onAddNodeType}>Add Node Type</button>
      </div>
    </div>
  );
};

const Settings = ({ plugin }: { plugin: DiscourseGraphPlugin }) => {
  const app = useApp();
  const [nodeTypes, setNodeTypes] = useState(plugin.settings.nodeTypes || []);

  // Initialize nodeTypes if undefined
  if (!plugin.settings.nodeTypes) {
    plugin.settings.nodeTypes = [];
  }

  const handleNodeTypeChange = async (
    index: number,
    field: "name" | "format",
    value: string,
  ) => {
    if (!plugin.settings.nodeTypes[index]) {
      plugin.settings.nodeTypes[index] = { name: "", format: "" };
    }
    plugin.settings.nodeTypes[index][field] = value;
    await plugin.saveSettings();
  };

  const handleAddNodeType = async () => {
    const updatedNodeTypes = [
      ...nodeTypes,
      {
        name: "",
        format: "",
      },
    ];
    setNodeTypes(updatedNodeTypes);
    plugin.settings.nodeTypes = updatedNodeTypes;
    await plugin.saveSettings();
  };

  // Add delete handler
  const handleDeleteNodeType = async (index: number) => {
    const updatedNodeTypes = nodeTypes.filter((_, i) => i !== index);
    setNodeTypes(updatedNodeTypes);
    plugin.settings.nodeTypes = updatedNodeTypes;
    await plugin.saveSettings();
  };
  return (
    <div>
      <h2>Discourse Graph Settings</h2>
      {/* Node Type Settings */}
      <NodeTypeSettings
        nodeTypes={nodeTypes}
        onNodeTypeChange={handleNodeTypeChange}
        onAddNodeType={handleAddNodeType}
        onDeleteNodeType={handleDeleteNodeType}
      />
      <h4>Settings for {app?.vault.getName()}</h4>;
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

    // Example obsidian settings
    const obsidianSettingsEl = containerEl.createDiv();
    new Setting(obsidianSettingsEl)
      .setName("Setting #1222")
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
}
