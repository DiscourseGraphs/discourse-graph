import { useState, useCallback } from "react";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";

export const FeatureFlagSettings = () => {
  const plugin = usePlugin();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);


  const handleSave = async () => {
    // Add more feature-flagged settings here as they are added
    await plugin.saveSettings();
    new Notice("Feature flag settings saved");
    setHasUnsavedChanges(false);
  };

  return (
    <div className="general-settings">
      {/* Database Sync Settings */}
      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Enable Database Sync</div>
          <div className="setting-item-description">
            Enable synchronization of Discourse Graph data to a Supabase
            database.
          </div>
        </div>
      </div>

      {/* Add more feature-flagged settings sections here */}

      <div className="setting-item">
        <button
          onClick={() => void handleSave()}
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
