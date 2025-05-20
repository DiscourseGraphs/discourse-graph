import React, { useState } from "react";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";

const FrontmatterSettings = () => {
  const plugin = usePlugin();
  const [hiddenKeys, setHiddenKeys] = useState(
    () => plugin.settings.hiddenFrontmatterKeys || [],
  );
  const [newKey, setNewKey] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleAddKey = () => {
    if (!newKey.trim()) return;

    if (hiddenKeys.includes(newKey.trim())) {
      new Notice(`Key "${newKey}" is already in the list`);
      return;
    }

    const updatedKeys = [...hiddenKeys, newKey.trim()];
    setHiddenKeys(updatedKeys);
    setNewKey("");
    setHasUnsavedChanges(true);
  };

  const handleRemoveKey = (keyToRemove: string) => {
    const updatedKeys = hiddenKeys.filter((key) => key !== keyToRemove);
    setHiddenKeys(updatedKeys);
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    plugin.settings.hiddenFrontmatterKeys = hiddenKeys;
    await plugin.saveSettings();
    new Notice("Frontmatter settings saved");
    setHasUnsavedChanges(false);
  };

  return (
    <div className="frontmatter-settings">
      <h3>Hidden Frontmatter Keys</h3>
      <p className="setting-item-description">
        Frontmatter keys in this list will be hidden from view
      </p>

      <div className="setting-item">
        <div className="flex w-full items-center gap-2">
          <input
            type="text"
            placeholder="Key name (e.g., nodeTypeId)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="flex-1"
          />
          <button
            onClick={handleAddKey}
            className="mod-cta"
            disabled={!newKey.trim()}
          >
            Add
          </button>
        </div>
      </div>

      {hiddenKeys.length > 0 ? (
        <div className="hidden-keys-list">
          {hiddenKeys.map((key) => (
            <div key={key} className="setting-item">
              <div className="flex w-full items-center justify-between">
                <span>{key}</span>
                <button
                  onClick={() => handleRemoveKey(key)}
                  className="mod-warning"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="setting-item">
          <div className="setting-item-description">
            No hidden keys. All frontmatter will be visible.
          </div>
        </div>
      )}

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

export default FrontmatterSettings;
