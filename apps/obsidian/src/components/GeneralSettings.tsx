import { useState, useCallback } from "react";
import { usePlugin } from "./PluginContext";
import { setIcon } from "obsidian";
import SuggestInput from "./SuggestInput";
import { DiscourseGraphLogoIcon, SlackLogoIcon } from "./Icons";
import { openExportSpecsModal } from "./ExportSpecsModal";
import { getDgSchemaFileName } from "~/utils/specValidation";
import { FeedbackModal } from "./FeedbackModal";
import { DOCS_URL, COMMUNITY_URL } from "~/constants";

const ToggleSetting = ({
  name,
  description,
  checked,
  onChange,
}: {
  name: string;
  description: string;
  checked: boolean;
  onChange: (newValue: boolean) => void;
}) => (
  <div className="setting-item">
    <div className="setting-item-info">
      <div className="setting-item-name">{name}</div>
      <div className="setting-item-description">{description}</div>
    </div>
    <div className="setting-item-control">
      <div
        className={`checkbox-container ${checked ? "is-enabled" : ""}`}
        onClick={() => onChange(!checked)}
      >
        <input
          type="checkbox"
          checked={checked}
          aria-label={name}
          onChange={(e) => onChange(e.target.checked)}
        />
      </div>
    </div>
  </div>
);

const InfoSection = () => {
  const plugin = usePlugin();

  return (
    <div className="flex justify-center">
      <div
        className="flex w-48 flex-col items-center rounded-lg p-3"
        style={{ background: "var(--tag-background)" }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center"
          style={{ color: "var(--interactive-accent)" }}
        >
          <DiscourseGraphLogoIcon />
        </div>
        <div
          className="font-semibold"
          style={{ color: "var(--interactive-accent)" }}
        >
          Discourse Graphs
        </div>

        <div className="mt-2 flex flex-col items-start gap-1">
          <a
            href={COMMUNITY_URL}
            className="flex items-center gap-1 text-sm no-underline hover:opacity-80"
            style={{ color: "var(--interactive-accent)" }}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Community"
          >
            <span className="icon flex w-4 items-center justify-center">
              <SlackLogoIcon />
            </span>
            <span>Community</span>
            <span
              className="icon"
              ref={(el) => (el && setIcon(el, "arrow-up-right")) || undefined}
            />
          </a>
          <a
            href={DOCS_URL}
            className="flex items-center gap-1 text-sm no-underline hover:opacity-80"
            style={{ color: "var(--interactive-accent)" }}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Docs"
          >
            <div
              className="icon flex w-4 items-center justify-center"
              ref={(el) => (el && setIcon(el, "book")) || undefined}
            />
            <span>Docs</span>
            <span
              className="icon"
              ref={(el) => (el && setIcon(el, "arrow-up-right")) || undefined}
            />
          </a>

          <button
            onClick={() => new FeedbackModal(plugin.app, plugin).open()}
            className="!m-0 flex !h-auto !min-h-0 cursor-pointer items-center gap-1 !rounded-none !border-0 !bg-transparent !p-0 !font-[inherit] text-sm !leading-[inherit] !text-[var(--interactive-accent)] no-underline !shadow-none hover:opacity-80 focus-visible:!outline focus-visible:!outline-2 focus-visible:!outline-offset-2"
            aria-label="Send feedback"
          >
            <span
              className="icon flex w-4 items-center justify-center"
              ref={(el) => (el && setIcon(el, "message-square")) || undefined}
            />
            <span>Send feedback</span>
          </button>
        </div>

        <span
          className="text-muted mt-2 text-xs"
          style={{ color: "var(--interactive-accent)" }}
        >
          {plugin.manifest.version}
        </span>
      </div>
    </div>
  );
};
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
  const [nodeTagHotkey, setNodeTagHotkey] = useState<string>(
    plugin.settings.nodeTagHotkey,
  );
  const schemaFileName = getDgSchemaFileName(plugin.app.vault.getName());
  const [showHelpMenuStatusBarIcon, setShowHelpMenuStatusBarIcon] = useState(
    plugin.settings.showHelpMenuStatusBarIcon,
  );

  const handleToggleChange = (newValue: boolean) => {
    setShowIdsInFrontmatter(newValue);
    plugin.settings.showIdsInFrontmatter = newValue;
    void plugin.saveSettings();
  };

  const handleHelpMenuStatusBarIconToggleChange = (newValue: boolean) => {
    setShowHelpMenuStatusBarIcon(newValue);
    plugin.settings.showHelpMenuStatusBarIcon = newValue;
    plugin.setHelpMenuStatusBarItemVisibility();
    void plugin.saveSettings();
  };

  const handleFolderPathChange = useCallback(
    (newValue: string) => {
      setNodesFolderPath(newValue);
      plugin.settings.nodesFolderPath = newValue.trim();
      void plugin.saveSettings();
    },
    [plugin],
  );

  const handleCanvasFolderPathChange = useCallback(
    (newValue: string) => {
      setCanvasFolderPath(newValue);
      plugin.settings.canvasFolderPath = newValue.trim();
      void plugin.saveSettings();
    },
    [plugin],
  );

  const handleCanvasAttachmentsFolderPathChange = useCallback(
    (newValue: string) => {
      setCanvasAttachmentsFolderPath(newValue);
      plugin.settings.canvasAttachmentsFolderPath = newValue.trim();
      void plugin.saveSettings();
    },
    [plugin],
  );

  const handleNodeTagHotkeyChange = useCallback(
    (newValue: string) => {
      // Only allow single character
      if (newValue.length <= 1) {
        setNodeTagHotkey(newValue);
        plugin.settings.nodeTagHotkey = newValue;
        void plugin.saveSettings();
      }
    },
    [plugin],
  );

  return (
    <div className="general-settings">
      <ToggleSetting
        name="Show IDs in frontmatter"
        description="Choose if you want IDs to show in the frontmatter. Controls visibility of node type IDs and relation type IDs."
        checked={showIdsInFrontmatter}
        onChange={handleToggleChange}
      />

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">
            Default discourse nodes folder path
          </div>
          <div className="setting-item-description">
            Default folder where new discourse nodes will be created. This is
            used as a fallback when a node type does not have a specific folder
            path set. Leave empty to create nodes in the root folder.
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
        <div className="setting-item-info">
          <div className="setting-item-name">Node tag hotkey</div>
          <div className="setting-item-description">
            Key to press after a space to open the node tags menu. Default:
            &quot;\&quot;.
          </div>
        </div>
        <div className="setting-item-control">
          <input
            type="text"
            value={nodeTagHotkey}
            onChange={(e) => handleNodeTagHotkeyChange(e.target.value)}
            onKeyDown={(e) => {
              // Capture the key pressed
              if (e.key.length === 1) {
                e.preventDefault();
                handleNodeTagHotkeyChange(e.key);
              } else if (e.key === "Backspace") {
                handleNodeTagHotkeyChange("");
              }
            }}
            placeholder="\"
            maxLength={1}
          />
        </div>
      </div>

      <div className="setting-item">
        <div className="setting-item-info">
          <div className="setting-item-name">Export discourse graph schema</div>
          <div className="setting-item-description">
            Export selected node types, relation types, relation triples, and
            templates to a JSON file named <code>{schemaFileName}</code>.
          </div>
        </div>
        <div className="setting-item-control">
          <button
            type="button"
            className="rounded border px-3 py-1.5 text-sm"
            onClick={() => openExportSpecsModal(plugin)}
          >
            Open export modal
          </button>
        </div>
      </div>
      <ToggleSetting
        name="Show help menu icon in status bar"
        description="Adds a Discourse Graph icon to the status bar that opens a menu with feedback, docs, community, and settings links."
        checked={showHelpMenuStatusBarIcon}
        onChange={handleHelpMenuStatusBarIconToggleChange}
      />

      <InfoSection />
    </div>
  );
};

export default GeneralSettings;
