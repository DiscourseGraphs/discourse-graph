import { useState, useCallback } from "react";
import { usePlugin } from "./PluginContext";
import { Notice, setIcon } from "obsidian";
import { updateUsername } from "~/utils/supabaseContext";
import { initializeSupabaseSync } from "~/utils/syncDgNodesToSupabase";
import { nextRoot } from "@repo/utils/execContext";
import { getLoggedInClient } from "~/utils/supabaseContext";

export const AdminPanelSettings = () => {
  const plugin = usePlugin();
  const [syncModeEnabled, setSyncModeEnabled] = useState<boolean>(
    plugin.settings.syncModeEnabled ?? false,
  );
  const [username, setUsername] = useState<string>(
    plugin.settings.username || "",
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

  const handleSetUsername = async (newValue: string) => {
    setUsername(newValue);
    plugin.settings.username = newValue;
    await plugin.saveSettings();
    await updateUsername(plugin, newValue);
  };

  const handleLoginHandoff = async () => {
    const client = await getLoggedInClient(plugin);
    if (!client) {
      new Notice("Failed to connect to the database", 3000);
      return;
    }
    const sessionData = await client.auth.getSession();
    if (!sessionData.data.session) {
      new Notice("Failed to connect to the database", 3000);
      return;
    }
    const { access_token, refresh_token } = sessionData.data.session;
    const { data, error } = await client.rpc("create_secret_token", {
      v_payload: JSON.stringify({ access_token, refresh_token }),
      expiry_interval: "45s",
    });
    if (error || typeof data !== "string") {
      new Notice("Failed to connect to the database", 3000);
      return;
    }
    if (data) window.open(`${nextRoot()}/auth/token?t=${data}&url=/`, "_blank");
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
            onClick={() => void handleSyncModeToggle(!syncModeEnabled)}
          >
            <input type="checkbox" checked={syncModeEnabled} />
          </div>
        </div>
      </div>
      <div
        className={
          "setting-item " + (plugin.settings.syncModeEnabled ? "" : "hidden")
        }
      >
        <div className="setting-item-info">
          <div className="setting-item-name">Username</div>
          <div className="setting-item-description">
            A username that will be associated with your vault if you share
            data.
          </div>
        </div>
        <div className="setting-item-control">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={(e) => void handleSetUsername(e.target.value)}
          />
        </div>
      </div>
      <div
        className={
          "setting-item " + (plugin.settings.syncModeEnabled ? "" : "hidden")
        }
      >
        <div className="setting-item-info">
          <div className="setting-item-name">Group management</div>
          <div className="setting-item-description">
            This will allow you to view and manage your sharing groups
          </div>
        </div>
        <div className="setting-item-control">
          <button
            onClick={() => {
              void handleLoginHandoff();
            }}
          >
            Manage groups
            <span
              className="icon"
              ref={(el) => (el && setIcon(el, "arrow-up-right")) || undefined}
            />
          </button>
        </div>
      </div>
    </div>
  );
};
