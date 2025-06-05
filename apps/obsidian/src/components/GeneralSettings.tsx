import React, { useState } from "react";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";

const GeneralSettings = () => {
  const plugin = usePlugin();
  const [showIdsInFrontmatter, setShowIdsInFrontmatter] = useState(
    plugin.settings.showIdsInFrontmatter,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleToggleChange = (newValue: boolean) => {
    setShowIdsInFrontmatter(newValue);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    plugin.settings.showIdsInFrontmatter = showIdsInFrontmatter;
    await plugin.saveSettings();
    new Notice("General settings saved");
    setHasUnsavedChanges(false);
  };

  return (
    <div className="general-settings">
      <h3>General Settings</h3>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Toggle IDs in frontmatter</div>
          <div className="setting-item-description">
            Choose if you want IDs to show in the frontmatter. Controls
            visibility of node type IDs and relation type IDs.
          </div>
        </div>
        <div className="setting-item-control">
          <div
            className={`checkbox-container ${showIdsInFrontmatter ? "is-enabled" : ""}`}
            onClick={() => handleToggleChange(!showIdsInFrontmatter)}
          >
            <input type="checkbox" checked={showIdsInFrontmatter} />
          </div>
        </div>
      </div>

      <div className="setting-item">
        <button
          onClick={handleSave}
          className={hasUnsavedChanges ? "mod-cta" : ""}
          disabled={!hasUnsavedChanges}
        >
          Save Changes
        </button>
      </div>

      {hasUnsavedChanges && (
        <div className="text-muted mt-2">You have unsaved changes</div>
      )}
    </div>
  );
};

export default GeneralSettings;
