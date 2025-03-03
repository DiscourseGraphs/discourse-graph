import { StrictMode, useState, useEffect } from "react";
import { App, PluginSettingTab } from "obsidian";
import type DiscourseGraphPlugin from "../index";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider, useApp } from "./AppContext";
import { validateNodeFormat } from "../utils/validateNodeFormat";

const NodeTypeSettings = ({ plugin }: { plugin: DiscourseGraphPlugin }) => {
  const [nodeTypes, setNodeTypes] = useState(
    () => plugin.settings.nodeTypes ?? [],
  );
  const [formatErrors, setFormatErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    const initializeSettings = async () => {
      let needsSave = false;

      if (!plugin.settings.nodeTypes) {
        plugin.settings.nodeTypes = [];
        needsSave = true;
      }

      if (needsSave) {
        await plugin.saveSettings();
      }
    };

    initializeSettings();
  }, [plugin]);

  const handleNodeTypeChange = async (
    index: number,
    field: "name" | "format",
    value: string,
  ): Promise<void> => {
    const updatedNodeTypes = [...nodeTypes];
    if (!updatedNodeTypes[index]) {
      updatedNodeTypes[index] = { name: "", format: "" };
    }

    updatedNodeTypes[index][field] = value;
    setNodeTypes(updatedNodeTypes);

    if (field === "format") {
      const { isValid, error } = validateNodeFormat(value);
      if (!isValid) {
        setFormatErrors((prev) => ({
          ...prev,
          [index]: error ?? "Invalid format",
        }));
      } else {
        setFormatErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[index];
          return newErrors;
        });
        plugin.settings.nodeTypes = updatedNodeTypes;
        await plugin.saveSettings();
      }
    } else {
      plugin.settings.nodeTypes = updatedNodeTypes;
      await plugin.saveSettings();
    }
  };

  const handleAddNodeType = async (): Promise<void> => {
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

  const handleDeleteNodeType = async (index: number): Promise<void> => {
    const updatedNodeTypes = nodeTypes.filter((_, i) => i !== index);
    setNodeTypes(updatedNodeTypes);
    plugin.settings.nodeTypes = updatedNodeTypes;
    await plugin.saveSettings();
  };
  return (
    <div className="discourse-node-types">
      <h3>Node Types</h3>
      {nodeTypes.map((nodeType, index) => (
        <div key={index} className="setting-item">
          <div
            style={{ display: "flex", flexDirection: "column", width: "100%" }}
          >
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Name"
                value={nodeType.name}
                onChange={(e) =>
                  handleNodeTypeChange(index, "name", e.target.value)
                }
                style={{ flex: 1 }}
              />
              <input
                type="text"
                placeholder="Format (e.g., [CLM] - {content})"
                value={nodeType.format}
                onChange={(e) =>
                  handleNodeTypeChange(index, "format", e.target.value)
                }
                style={{ flex: 2 }}
              />
              <button
                onClick={() => handleDeleteNodeType(index)}
                className="mod-warning"
              >
                Delete
              </button>
            </div>
            {formatErrors[index] && (
              <div
                style={{
                  color: "var(--text-error)",
                  fontSize: "12px",
                  marginTop: "4px",
                }}
              >
                {formatErrors[index]}
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="setting-item">
        <button onClick={handleAddNodeType}>Add Node Type</button>
      </div>
    </div>
  );
};

const Settings = ({ plugin }: { plugin: DiscourseGraphPlugin }) => {
  return (
    <div>
      <NodeTypeSettings plugin={plugin} />
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