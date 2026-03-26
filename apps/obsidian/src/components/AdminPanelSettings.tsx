import { useState, useCallback } from "react";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";
import { initializeSupabaseSync } from "~/utils/syncDgNodesToSupabase";

export const AdminPanelSettings = () => {
  const plugin = usePlugin();
  const [syncModeEnabled, setSyncModeEnabled] = useState<boolean>(
    plugin.settings.syncModeEnabled ?? false,
  );

  const handleSyncModeToggle = useCallback(
    async (newValue: boolean) => {
      setSyncModeEnabled(newValue);
      plugin.settings.syncModeEnabled = newValue;
      await plugin.saveSettings();

      if (newValue) {
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
    },
    [plugin],
  );

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
            onClick={() => void handleSyncModeToggle(!syncModeEnabled)}
          >
            <input type="checkbox" checked={syncModeEnabled} />
          </div>
        </div>
      </div>
    </div>
  );
};
