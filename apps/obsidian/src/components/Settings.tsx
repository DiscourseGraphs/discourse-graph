import { StrictMode } from "react";
import { App, PluginSettingTab, Setting } from "obsidian";
import type DiscourseGraphPlugin from "../index";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider, useApp } from "./AppContext";

const NodeTypeSettings = ({
  nodeTypes,
  onNodeTypeChange,
  onAddNodeType,
}: {
  nodeTypes: Array<{ name: string; format: string }>;
  onNodeTypeChange: (
    index: number,
    field: "name" | "format",
    value: string,
  ) => Promise<void>;
  onAddNodeType: () => Promise<void>;
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
  if (!app) {
    return <div>An error occurred</div>;
  }

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
    plugin.settings.nodeTypes.push({
      name: "",
      format: "",
    });
    await plugin.saveSettings();
  };
);



  return (
    <div>
      <h2>Discourse Graph Settings</h2>
      {/* Original setting */}
      <Setting>
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Setting #1</div>
            <div className="setting-item-description">It's a secret</div>
          </div>
          <div className="setting-item-control">
            <input
              type="text"
              placeholder="Enter your secret"
              value={plugin.settings.mySetting}
              onChange={async (e) => {
                plugin.settings.mySetting = e.target.value;
                await plugin.saveSettings();
              }}
            />
          </div>
        </div>
      </Setting>
      {/* Node Type Settings */}
      <NodeTypeSettings
        nodeTypes={plugin.settings.nodeTypes}
        onNodeTypeChange={handleNodeTypeChange}
        onAddNodeType={handleAddNodeType}
      />
      <h4>Settings for {app.vault.getName()}</h4>;
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
