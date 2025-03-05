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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
    setHasUnsavedChanges(true);

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
      }
    }
  };

  const handleAddNodeType = (): void => {
    const updatedNodeTypes = [
      ...nodeTypes,
      {
        name: "",
        format: "",
      },
    ];
    setNodeTypes(updatedNodeTypes);
    setHasUnsavedChanges(true);
  };

  const handleDeleteNodeType = async (index: number): Promise<void> => {
    const updatedNodeTypes = nodeTypes.filter((_, i) => i !== index);
    setNodeTypes(updatedNodeTypes);
    plugin.settings.nodeTypes = updatedNodeTypes;
    await plugin.saveSettings();
  };

  const handleSave = async (): Promise<void> => {
    let hasErrors = false;
    for (let i = 0; i < nodeTypes.length; i++) {
      const { isValid, error } = validateNodeFormat(nodeTypes[i]?.format ?? "");
      if (!isValid) {
        setFormatErrors((prev) => ({
          ...prev,
          [i]: error ?? "Invalid format",
        }));
        hasErrors = true;
      }
    }

    if (hasErrors) {
      return;
    }

    plugin.settings.nodeTypes = nodeTypes;
    await plugin.saveSettings();
    setHasUnsavedChanges(false);
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
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleAddNodeType}>Add Node Type</button>
          <button
            onClick={handleSave}
            className={hasUnsavedChanges ? "mod-cta" : ""}
            disabled={
              !hasUnsavedChanges || Object.keys(formatErrors).length > 0
            }
          >
            Save Changes
          </button>
        </div>
      </div>
      {hasUnsavedChanges && (
        <div style={{ marginTop: "8px", color: "var(--text-muted)" }}>
          You have unsaved changes
        </div>
      )}
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