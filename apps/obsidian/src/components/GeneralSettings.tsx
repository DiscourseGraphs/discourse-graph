import { useState, useCallback } from "react";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";
import SuggestInput from "./SuggestInput";

export const FolderSuggestInput = ({
  value,
  onChange,
  placeholder = "Enter folder path",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) => {
  const plugin = usePlugin();

  const getAllFolders = useCallback((): string[] => {
    const folders = plugin.app.vault.getAllFolders();
    return folders.map((folder) => folder.path).sort();
  }, [plugin.app.vault]);

  const getFilteredFolders = useCallback(
    (query: string): string[] => {
      const allFolders = getAllFolders();

      if (!query.trim()) {
        return allFolders.slice(0, 10);
      }

      return allFolders
        .filter((path) => path.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 10);
    },
    [getAllFolders],
  );

  const renderFolder = useCallback((folder: string, el: HTMLElement) => {
    el.createDiv({
      text: folder || "(Root folder)",
      cls: "folder-suggestion-item",
    });
  }, []);

  const getDisplayText = useCallback((folder: string) => folder, []);

  return (
    <SuggestInput<string>
      value={value}
      onChange={onChange}
      getSuggestions={getFilteredFolders}
      getDisplayText={getDisplayText}
      renderItem={renderFolder}
      placeholder={placeholder}
      className={className}
      disabled={disabled}
    />
  );
};

const GeneralSettings = () => {
  const plugin = usePlugin();
  const [showIdsInFrontmatter, setShowIdsInFrontmatter] = useState(
    plugin.settings.showIdsInFrontmatter,
  );
  const [nodesFolderPath, setNodesFolderPath] = useState(
    plugin.settings.nodesFolderPath,
  );
  const [canvasFolderPath, setCanvasFolderPath] = useState<string>(
    plugin.settings.canvasFolderPath,
  );
  const [canvasAttachmentsFolderPath, setCanvasAttachmentsFolderPath] =
    useState<string>(plugin.settings.canvasAttachmentsFolderPath);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleToggleChange = (newValue: boolean) => {
    setShowIdsInFrontmatter(newValue);
    setHasUnsavedChanges(true);
  };

  const handleFolderPathChange = useCallback((newValue: string) => {
    setNodesFolderPath(newValue);
    setHasUnsavedChanges(true);
  }, []);

  const handleCanvasFolderPathChange = useCallback((newValue: string) => {
    setCanvasFolderPath(newValue);
    setHasUnsavedChanges(true);
  }, []);

  const handleCanvasAttachmentsFolderPathChange = useCallback(
    (newValue: string) => {
      setCanvasAttachmentsFolderPath(newValue);
      setHasUnsavedChanges(true);
    },
    [],
  );

  const handleSave = async () => {
    plugin.settings.showIdsInFrontmatter = showIdsInFrontmatter;
    plugin.settings.nodesFolderPath = nodesFolderPath;
    plugin.settings.canvasFolderPath = canvasFolderPath;
    plugin.settings.canvasAttachmentsFolderPath = canvasAttachmentsFolderPath;
    await plugin.saveSettings();
    new Notice("General settings saved");
    setHasUnsavedChanges(false);
  };

  return (
    <div className="general-settings">
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
          <div className="setting-item-name">Discourse Nodes folder path</div>
          <div className="setting-item-description">
            Specify the folder where new Discourse Nodes should be created.
            Leave empty to create nodes in the root folder.
          </div>
        </div>
        <div className="setting-item-control">
          <FolderSuggestInput
            value={nodesFolderPath}
            onChange={handleFolderPathChange}
            placeholder="Example: folder 1/folder"
          />
        </div>
      </div>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Canvas folder path</div>
          <div className="setting-item-description">
            Folder where new Discourse Graph canvases will be created. Default:
            &quot;Discourse Canvas&quot;.
          </div>
        </div>
        <div className="setting-item-control">
          <FolderSuggestInput
            value={canvasFolderPath}
            onChange={handleCanvasFolderPathChange}
            placeholder="Example: Discourse Canvas"
          />
        </div>
      </div>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">
            Canvas attachments folder path
          </div>
          <div className="setting-item-description">
            Folder where attachments for canvases are stored. Default:
            &quot;attachments&quot;.
          </div>
        </div>
        <div className="setting-item-control">
          <FolderSuggestInput
            value={canvasAttachmentsFolderPath}
            onChange={handleCanvasAttachmentsFolderPathChange}
            placeholder="Example: attachments"
          />
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

export default GeneralSettings;
