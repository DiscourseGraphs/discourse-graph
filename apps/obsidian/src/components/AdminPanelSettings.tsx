import { useState } from "react";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";

export const AdminPanelSettings = () => {
  const plugin = usePlugin();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleSave = async () => {
    await plugin.saveSettings();
    new Notice("Admin panel settings saved");
    setHasUnsavedChanges(false);
  };

  return (
    <div className="general-settings">
      {/* Add more admin panel settings sections here */}

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
