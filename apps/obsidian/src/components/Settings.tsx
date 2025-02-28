import { StrictMode, useState, useEffect } from "react";
import { App, Hotkey, Modifier, PluginSettingTab, Setting } from "obsidian";
import type DiscourseGraphPlugin from "../index";
import { Root, createRoot } from "react-dom/client";
import { ContextProvider, useApp } from "./AppContext";
import { getDiscourseNodeFormatExpression } from "../utils/getDiscourseNodeFormatExpression";

const NodeTypeSettings = ({
  nodeTypes,
  onNodeTypeChange,
  onAddNodeType,
  onDeleteNodeType,
  formatErrors,
}: {
  nodeTypes: Array<{ name: string; format: string }>;
  onNodeTypeChange: (
    index: number,
    field: "name" | "format",
    value: string,
  ) => Promise<void>;
  onAddNodeType: () => Promise<void>;
  onDeleteNodeType: (index: number) => Promise<void>;
  formatErrors: Record<number, string>;
}) => {
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
                  onNodeTypeChange(index, "name", e.target.value)
                }
                style={{ flex: 1 }}
              />
              <input
                type="text"
                placeholder="Format (e.g., [CLM] - {content})"
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
        <button onClick={onAddNodeType}>Add Node Type</button>
      </div>
    </div>
  );
};

const HotkeyInput = ({
  value,
  onChange,
}: {
  value: Hotkey;
  onChange: (hotkey: Hotkey) => Promise<void>;
}) => {
  const [isListening, setIsListening] = useState(false);
  const [currentHotkey, setCurrentHotkey] = useState<Hotkey>(value);

  const handleKeyDown = (e: KeyboardEvent) => {
    e.preventDefault();

    if (!(e.ctrlKey || e.metaKey || e.altKey || e.shiftKey)) return;

    const modifiers: Modifier[] = [];
    if (e.ctrlKey) modifiers.push("Ctrl");
    if (e.metaKey) modifiers.push("Meta");
    if (e.altKey) modifiers.push("Alt");
    if (e.shiftKey) modifiers.push("Shift");

    const newHotkey: Hotkey = {
      modifiers,
      key: e.key.toUpperCase(),
    };

    setCurrentHotkey(newHotkey);
  };

  useEffect(() => {
    if (isListening) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [isListening]);

  const formatHotkey = (hotkey: Hotkey) => {
    if (!hotkey || !hotkey.modifiers) return "";

    const formattedModifiers = hotkey.modifiers.map((mod) => {
      switch (mod) {
        case "Mod":
          return "Cmd/Ctrl";
        case "Meta":
          return "Cmd/Win";
        default:
          return mod;
      }
    });

    return [...formattedModifiers, hotkey.key].join(" + ");
  };

  const handleSave = async () => {
    try {
      await onChange(currentHotkey);
      setIsListening(false);
    } catch (error) {
      console.error("Failed to save hotkey:", error);
    }
  };

  return (
    <div>
      <input type="text" value={formatHotkey(currentHotkey)} readOnly />
      <button
        onClick={() => setIsListening(!isListening)}
        className={isListening ? "mod-warning" : ""}
      >
        {isListening ? "Listening..." : "Edit"}
      </button>
      {isListening && <button onClick={handleSave}>Save</button>}
    </div>
  );
};

const Settings = ({ plugin }: { plugin: DiscourseGraphPlugin }) => {
  const app = useApp();
  const [nodeTypes, setNodeTypes] = useState(
    () => plugin.settings.nodeTypes ?? [],
  );
  const [nodeTypeHotkey, setNodeTypeHotkey] = useState(
    () =>
      plugin.settings.nodeTypeHotkey ?? {
        modifiers: ["Ctrl"],
        key: "\\",
      },
  );
  const [formatErrors, setFormatErrors] = useState<Record<number, string>>({});

  useEffect(() => {
    const initializeSettings = async () => {
      let needsSave = false;

      if (!plugin.settings.nodeTypes) {
        plugin.settings.nodeTypes = [];
        needsSave = true;
      }

      if (!plugin.settings.nodeTypeHotkey) {
        plugin.settings.nodeTypeHotkey = {
          modifiers: ["Ctrl"],
          key: "\\",
        };
        needsSave = true;
      }

      if (needsSave) {
        await plugin.saveSettings();
      }
    };

    initializeSettings();
  }, [plugin]);

  const validateFormat = (format: string): boolean => {
    // TODO: fix validation format
    if (!format) return true; // Empty format is valid
    try {
      const regex = getDiscourseNodeFormatExpression(format);
      // Test with a sample string to make sure it's a valid format
      return regex.test("[TEST] - Sample content");
    } catch (e) {
      return false;
    }
  };

  const handleNodeTypeChange = async (
    index: number,
    field: "name" | "format",
    value: string,
  ) => {
    const updatedNodeTypes = [...nodeTypes];
    if (!updatedNodeTypes[index]) {
      updatedNodeTypes[index] = { name: "", format: "" };
    }

    updatedNodeTypes[index][field] = value;
    setNodeTypes(updatedNodeTypes);

    if (field === "format") {
      const isValid = value === "" || validateFormat(value);
      if (!isValid) {
        setFormatErrors((prev) => ({
          ...prev,
          [index]:
            "Invalid format. You can use any {variable} in your format, e.g., [TYPE] - {content}",
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

  const handleDeleteNodeType = async (index: number) => {
    const updatedNodeTypes = nodeTypes.filter((_, i) => i !== index);
    setNodeTypes(updatedNodeTypes);
    plugin.settings.nodeTypes = updatedNodeTypes;
    await plugin.saveSettings();
  };

  const handleHotkeyChange = async (newHotkey: Hotkey) => {
    try {
      plugin.settings.nodeTypeHotkey = newHotkey;
      await plugin.saveSettings();
      setNodeTypeHotkey(newHotkey);
      setNodeTypeHotkey(plugin.settings.nodeTypeHotkey);
    } catch (error) {
      console.error("Failed to save hotkey:", error);
    }
  };

  return (
    <div>
      <h2>Discourse Graph Settings</h2>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Node Type Hotkey</div>
          <div className="setting-item-description">
            <p>
              This hotkey will open the node type menu to instantly create a new
              node.
            </p>
            <p>Click Edit and press a modifier + key combination</p>
          </div>
        </div>
        <HotkeyInput
          value={nodeTypeHotkey}
          onChange={async (newHotkey) => {
            await handleHotkeyChange(newHotkey);
          }}
        />
      </div>

      <NodeTypeSettings
        nodeTypes={nodeTypes}
        onNodeTypeChange={handleNodeTypeChange}
        onAddNodeType={handleAddNodeType}
        onDeleteNodeType={handleDeleteNodeType}
        formatErrors={formatErrors}
      />
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
}