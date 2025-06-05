import React, { useState } from "react";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";

const GeneralSettings = () => {
  const plugin = usePlugin();
  const [showIdsInFrontmatter, setShowIdsInFrontmatter] = useState(
    plugin.settings.showIdsInFrontmatter,
  );
  const [nodesFolderPath, setNodesFolderPath] = useState(
    plugin.settings.nodesFolderPath,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleToggleChange = (newValue: boolean) => {
    setShowIdsInFrontmatter(newValue);
    setHasUnsavedChanges(true);
  };

  const handleFolderPathChange = (newValue: string) => {
    setNodesFolderPath(newValue);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    plugin.settings.showIdsInFrontmatter = showIdsInFrontmatter;
    plugin.settings.nodesFolderPath = nodesFolderPath;
    await plugin.saveSettings();
    new Notice("General settings saved");
    setHasUnsavedChanges(false);
  };

  return (
    <div className="general-settings">
      <h3>General Settings</h3>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Show IDs in frontmatter</div>
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
        <div className="setting-item-info">
          <div className="setting-item-name">Discourse nodes folder path</div>
          <div className="setting-item-description">
            Specify the folder where new Discourse nodes should be created.
            Leave empty to create nodes in the root folder.
          </div>
        </div>
        <div className="setting-item-control">
          <input
            type="text"
            value={nodesFolderPath}
            onChange={(e) => handleFolderPathChange(e.target.value)}
            placeholder="Discourse Nodes"
          />
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
