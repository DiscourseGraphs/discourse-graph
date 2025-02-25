import { StrictMode, useState, useEffect } from "react";
import { App, Hotkey, Modifier, PluginSettingTab, Setting } from "obsidian";
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
  const [formatErrors, setFormatErrors] = useState<Record<number, string>>({});

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
                placeholder="Format (e.g., [CLM]-{content})"
                value={nodeType.format}
                onChange={(e) => {
                  const value = e.target.value;
                  const isValid = /^\[([A-Z-]+)\]\s-\s\{content\}$/.test(value);
                  if (!isValid && value !== "") {
                    setFormatErrors((prev) => ({
                      ...prev,
                      [index]:
                        "Format must be [KEYWORD] - {content} with uppercase keyword",
                    }));
                  } else {
                    setFormatErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors[index];
                      return newErrors;
                    });
                  }
                  onNodeTypeChange(index, "format", value);
                }}
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
  onChange: (hotkey: Hotkey) => void;
}) => {
  console.log("HotkeyInput value:", value); // Debug log

  const [isListening, setIsListening] = useState(false);
  const [currentHotkey, setCurrentHotkey] = useState<Hotkey>(value);

  const handleKeyDown = (e: KeyboardEvent) => {
    e.preventDefault();

    // Only proceed if at least one modifier is pressed
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

  return (
    <div>
      <input type="text" value={formatHotkey(currentHotkey)} readOnly />
      <button
        onClick={() => setIsListening(!isListening)}
        className={isListening ? "mod-warning" : ""}
      >
        {isListening ? "Listening..." : "Edit"}
      </button>
      {isListening && (
        <button
          onClick={() => {
            onChange(currentHotkey);
            setIsListening(false);
          }}
        >
          Save
        </button>
      )}
    </div>
  );
};

const Settings = ({ plugin }: { plugin: DiscourseGraphPlugin }) => {
  const app = useApp();
  const [nodeTypes, setNodeTypes] = useState(plugin.settings.nodeTypes || []);
  const [nodeTypeHotkey, setNodeTypeHotkey] = useState(
    plugin.settings.nodeTypeHotkey,
  );
  // Initialize nodeTypes if undefined
  if (!plugin.settings.nodeTypes) {
    plugin.settings.nodeTypes = [];
  }

  // Initialize nodeTypeHotkey if undefined
  if (!plugin.settings.nodeTypeHotkey) {
    plugin.settings.nodeTypeHotkey = {
      modifiers: ["Ctrl"],
      key: "\\",
    };
  }

  const validateFormat = (format: string): boolean => {
    const formatRegex = /^\[([A-Z-]+)\]\s-\s\{content\}$/;
    return formatRegex.test(format);
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

    // Only save if format is valid or empty
    if (field === "format") {
      if (value === "" || validateFormat(value)) {
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

  return (
    <div>
      <h2>Discourse Graph Settings</h2>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Node Type Hotkey</div>
          <div className="setting-item-description">
            Click Edit and press a modifier + key combination
          </div>
        </div>
        <HotkeyInput
          value={nodeTypeHotkey}
          onChange={async (newHotkey) => {
            setNodeTypeHotkey(newHotkey);
            plugin.settings.nodeTypeHotkey = newHotkey;
            await plugin.saveSettings();
          }}
        />
      </div>

      <NodeTypeSettings
        nodeTypes={nodeTypes}
        onNodeTypeChange={handleNodeTypeChange}
        onAddNodeType={handleAddNodeType}
        onDeleteNodeType={handleDeleteNodeType}
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

    // Example obsidian settings
    // const obsidianSettingsEl = containerEl.createDiv();
    // new Setting(obsidianSettingsEl)
    //   .setName("Setting #1222")
    //   .setDesc("It's a secret")
    //   .addText((text) =>
    //     text
    //       .setPlaceholder("Enter your secret")
    //       .setValue(this.plugin.settings.mySetting)
    //       .onChange(async (value) => {
    //         this.plugin.settings.mySetting = value;
    //         await this.plugin.saveSettings();
    //       }),
    //   );

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
