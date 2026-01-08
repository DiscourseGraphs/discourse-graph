import { useState, useCallback } from "react";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";
import { initializeSupabaseSync } from "~/utils/syncDgNodesToSupabase";

export const AdminPanelSettings = () => {
  const plugin = usePlugin();
  const [syncModeEnabled, setSyncModeEnabled] = useState<boolean>(
    plugin.settings.syncModeEnabled ?? false,
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleSyncModeToggle = useCallback((newValue: boolean) => {
    setSyncModeEnabled(newValue);
    setHasUnsavedChanges(true);
  }, []);

  const handleSave = async () => {
    plugin.settings.syncModeEnabled = syncModeEnabled;
    await plugin.saveSettings();
    new Notice("Admin panel settings saved");
    setHasUnsavedChanges(false);

    if (syncModeEnabled) {
      try {
        await initializeSupabaseSync(plugin);
        new Notice("Sync mode initialized successfully");
      } catch (error) {
        console.error("Failed to initialize sync mode:", error);
        new Notice(
          `Failed to initialize sync mode: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  };

  return (
    <div className="general-settings">
      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">(BETA) Sync mode enable</div>
          <div className="setting-item-description">
            Enable synchronization with Discourse Graph database
          </div>
        </div>
        <div className="setting-item-control">
          <div
            className={`checkbox-container ${syncModeEnabled ? "is-enabled" : ""}`}
            onClick={() => handleSyncModeToggle(!syncModeEnabled)}
          >
            <input type="checkbox" checked={syncModeEnabled} />
          </div>
        </div>
      </div>

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
