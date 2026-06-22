import { useState, useEffect, useRef, useCallback } from "react";
import { validateNodeFormat, validateNodeName } from "~/utils/validateNodeType";
import { usePlugin } from "./PluginContext";
import { App, Component, MarkdownRenderer, Notice, setIcon } from "obsidian";
import generateUid from "~/utils/generateUid";
import { DiscourseNode } from "~/types";
import { ConfirmationModal } from "./ConfirmationModal";
import {
  createTemplateFileWithUniqueName,
  getImportedTemplateFileName,
  getTemplateFiles,
  getTemplatePluginInfo,
} from "~/utils/templates";
import {
  getImportInfo,
  formatImportSource,
  getAndFormatImportSource,
  getUserNameById,
} from "~/utils/typeUtils";
import { FolderSuggestInput } from "./GeneralSettings";
import { createBaseForNodeType } from "~/utils/baseForNodeType";
import {
  fetchTemplateImportCandidates,
  type TemplateImportCandidate,
} from "~/utils/templateImport";

const generateTagPlaceholder = (format: string, nodeName?: string): string => {
  if (!format) return "Enter tag (e.g., clm-candidate)";

  // Extract the prefix before " - {content}" or " -{content}" or " -{content}" etc.
  const match = format.match(/^([A-Z]+)\s*-\s*\{content\}/i);
  if (match && match[1]) {
    const prefix = match[1].toLowerCase();
    return `Enter tag (e.g., ${prefix}-candidate)`;
  }

  if (nodeName && nodeName.length >= 3) {
    const prefix = nodeName.substring(0, 3).toLowerCase();
    return `Enter tag (e.g., ${prefix}-candidate)`;
  }

  return "Enter tag (e.g., clm-candidate)";
};

type EditableFieldKey = keyof Omit<
  DiscourseNode,
  "id" | "shortcut" | "modified" | "created" | "importedFromRid"
>;

type BaseFieldConfig = {
  key: EditableFieldKey;
  label: string;
  description: string;
  required?: boolean;
  type: "text" | "select" | "color" | "boolean";
  placeholder?: string;
  validate?: (
    value: string,
    nodeType: DiscourseNode,
    existingNodes: DiscourseNode[],
  ) => { isValid: boolean; error?: string };
};

const FIELD_CONFIGS: Partial<Record<EditableFieldKey, BaseFieldConfig>> = {
  name: {
    key: "name",
    label: "Name",
    description: "The name of this node type",
    required: true,
    type: "text",
    validate: (value, nodeType, existingNodes) =>
      validateNodeName({
        name: value,
        currentNode: nodeType,
        allNodes: existingNodes,
      }),
    placeholder: "Name",
  },
  format: {
    key: "format",
    label: "Format",
    description:
      "The format pattern for this node type (e.g., CLM - {content})",
    required: true,
    type: "text",
    validate: (value, nodeType, existingNodes) =>
      validateNodeFormat({
        format: value,
        currentNode: nodeType,
        allNodes: existingNodes,
      }),
    placeholder: "Format (e.g., CLM - {content})",
  },
  description: {
    key: "description",
    label: "Description",
    description: "A brief description of what this node type represents",
    required: false,
    type: "text",
    placeholder: "Enter a description",
  },
  template: {
    key: "template",
    label: "Template",
    description: "The template to use for this node type",
    type: "select",
    required: false,
  },
  color: {
    key: "color",
    label: "Color",
    description: "The color to use for this node type",
    type: "color",
    required: false,
  },
  tag: {
    key: "tag",
    label: "Node tag",
    description: "Tags that signal a line is a node candidate",
    type: "text",
    required: false,
    validate: (value: string) => {
      if (!value.trim()) return { isValid: true };
      if (/\s/.test(value)) {
        return { isValid: false, error: "Tag cannot contain spaces" };
      }
      const invalidTagChars = /[^a-zA-Z0-9-]/;
      const invalidCharMatch = value.match(invalidTagChars);
      if (invalidCharMatch) {
        return {
          isValid: false,
          error: `Tag contains invalid character: ${invalidCharMatch[0]}. Tags can only contain letters, numbers, and dashes.`,
        };
      }

      return { isValid: true };
    },
  },
  keyImage: {
    key: "keyImage",
    label: "Key image (first image from file)",
    description:
      "When enabled, canvas nodes of this type will show the first image from the linked file",
    type: "boolean",
    required: false,
  },
};

const FIELD_CONFIG_ARRAY = Object.values(FIELD_CONFIGS);

const BooleanField = ({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) => (
  <div
    className={`checkbox-container ${value ? "is-enabled" : ""}`}
    onClick={() => {
      if (!disabled) onChange(!value);
    }}
  >
    <input type="checkbox" checked={!!value} disabled={disabled} readOnly />
  </div>
);

const TextField = ({
  fieldConfig,
  value,
  error,
  onChange,
  onBlur,
  nodeType,
  disabled,
}: {
  fieldConfig: BaseFieldConfig;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  nodeType?: DiscourseNode;
  disabled?: boolean;
}) => {
  // Generate dynamic placeholder for tag field based on node format and name
  const getPlaceholder = (): string => {
    if (fieldConfig.key === "tag" && nodeType?.format) {
      return generateTagPlaceholder(nodeType.format, nodeType.name);
    }
    return fieldConfig.placeholder || "";
  };

  return (
    <input
      type="text"
      value={value || ""}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={getPlaceholder()}
      className={`w-full ${error ? "input-error" : ""}`}
      disabled={disabled}
    />
  );
};

const ColorField = ({
  value,
  error,
  onChange,
  disabled,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) => (
  <input
    type="color"
    value={value || "#000000"}
    onChange={(e) => onChange(e.target.value)}
    className={`h-8 w-20 ${error ? "input-error" : ""}`}
    disabled={disabled}
  />
);

const TemplateField = ({
  value,
  error,
  onChange,
  templateConfig,
  templateFiles,
  disabled,
  onImportClick,
  importDisabledReason,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  templateConfig: { isEnabled: boolean; folderPath: string };
  templateFiles: string[];
  disabled?: boolean;
  onImportClick: () => void;
  importDisabledReason?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const isTemplateConfigured =
    templateConfig.isEnabled && !!templateConfig.folderPath;
  const isDisabled = disabled || !isTemplateConfigured;
  const displayValue = !isTemplateConfigured
    ? "Template folder not configured"
    : value
      ? value
      : "No template";

  const handleSelect = (nextValue: string): void => {
    onChange(nextValue);
    setIsOpen(false);
  };

  const menuItemStyle = {
    background: "transparent",
    border: "none",
    borderRadius: 0,
    boxShadow: "none",
    color: "var(--text-normal)",
    fontSize: "var(--font-ui-small)",
    height: "28px",
    justifyContent: "flex-start",
    padding: "4px 10px",
    textAlign: "left" as const,
    width: "100%",
  };

  return (
    <div className="relative w-full min-w-48">
      <button
        type="button"
        className={`dropdown w-full text-left ${error ? "input-error" : ""}`}
        disabled={isDisabled}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="truncate">{displayValue}</span>
      </button>
      {isOpen && (
        <div
          className="absolute right-0 z-50 mt-1 w-full min-w-56 overflow-hidden"
          style={{
            background: "var(--background-primary)",
            border: "1px solid var(--background-modifier-border)",
            borderRadius: "var(--radius-s)",
            boxShadow: "var(--shadow-s)",
            padding: "4px",
          }}
        >
          <button
            type="button"
            className="flex"
            style={{
              ...menuItemStyle,
              fontStyle: "italic",
              justifyContent: "space-between",
            }}
            onClick={() => handleSelect("")}
          >
            <span className="truncate">No template</span>
          </button>
          {templateFiles.map((templateFile) => (
            <button
              type="button"
              key={templateFile}
              className="flex"
              style={{
                ...menuItemStyle,
                justifyContent: "space-between",
              }}
              onClick={() => handleSelect(templateFile)}
            >
              <span className="truncate">{templateFile}</span>
            </button>
          ))}
          <div
            style={{
              borderTop: "1px solid var(--background-modifier-border)",
              marginTop: "4px",
              paddingTop: "4px",
            }}
          >
            <button
              type="button"
              className="flex disabled:opacity-60"
              style={{
                ...menuItemStyle,
                color: "var(--text-accent)",
                fontWeight: "var(--font-medium)",
                justifyContent: "space-between",
              }}
              disabled={!!importDisabledReason}
              title={importDisabledReason}
              onClick={() => {
                setIsOpen(false);
                onImportClick();
              }}
            >
              <span className="truncate">Import template from groups...</span>
              <span aria-hidden="true">&gt;</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const FieldWrapper = ({
  fieldConfig,
  children,
  error,
}: {
  fieldConfig: BaseFieldConfig;
  children: React.ReactNode;
  error?: string;
}) => (
  <div className="setting-item" key={fieldConfig.key}>
    <div className="setting-item-info">
      <div className="setting-item-name">{fieldConfig.label}</div>
      <div className="setting-item-description">{fieldConfig.description}</div>
    </div>
    <div className="setting-item-control">
      <div className="flex flex-col">
        {children}
        <div className="mt-1 min-h-[1rem] text-xs">
          {error && <div className="text-error">{error}</div>}
        </div>
      </div>
    </div>
  </div>
);

const formatRelativeTime = (timestamp?: number): string => {
  if (!timestamp) return "unknown";

  const diffMs = Date.now() - timestamp;
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;

  const diffWeeks = Math.floor(diffDays / 7);
  if (diffWeeks === 1) return "1 week ago";
  if (diffWeeks < 5) return `${diffWeeks} weeks ago`;

  const diffMonths = Math.floor(diffDays / 30);
  if (diffMonths <= 1) return "1 month ago";
  return `${diffMonths} months ago`;
};

const MarkdownTemplatePreview = ({
  app,
  templateContent,
  sourcePath,
  className,
}: {
  app: App;
  templateContent: string;
  sourcePath: string;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";
    const component = new Component();
    void MarkdownRenderer.render(
      app,
      templateContent.trim() || "This template is empty.",
      container,
      sourcePath,
      component,
    );

    return () => {
      component.unload();
      container.innerHTML = "";
    };
  }, [app, sourcePath, templateContent]);

  return (
    <div
      ref={containerRef}
      className={`markdown-rendered text-sm leading-6 ${className ?? ""}`}
    />
  );
};

const TemplateImportPanel = ({
  app,
  nodeTypeName,
  candidates,
  selectedCandidateId,
  isLoading,
  isImporting,
  error,
  templateFolderPath,
  onSelectCandidate,
  onClose,
  onImport,
}: {
  app: App;
  nodeTypeName: string;
  candidates: TemplateImportCandidate[];
  selectedCandidateId: number | null;
  isLoading: boolean;
  isImporting: boolean;
  error?: string;
  templateFolderPath: string;
  onSelectCandidate: (candidateId: number) => void;
  onClose: () => void;
  onImport: () => void;
}) => {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const selectedCandidate =
    candidates.find((candidate) => candidate.id === selectedCandidateId) ??
    candidates[0];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleBackdropPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
  ): void => {
    if (
      panelRef.current &&
      event.target instanceof Node &&
      !panelRef.current.contains(event.target)
    ) {
      onClose();
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
      onPointerDown={handleBackdropPointerDown}
    >
      <div
        ref={panelRef}
        className="border-modifier-border flex h-[min(760px,92vh)] w-[min(980px,96vw)] flex-col overflow-hidden rounded-xl border bg-primary shadow-2xl"
      >
        <div className="border-modifier-border flex items-start justify-between border-b p-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              className="icon-button mt-0.5"
              aria-label="Back to node type settings"
              onClick={onClose}
            >
              <div
                className="icon"
                ref={(el) => (el && setIcon(el, "arrow-left")) || undefined}
              />
            </button>
            <div>
              <h3 className="dg-h3 mb-1">Import template from groups</h3>
              <p className="text-muted text-sm">
                {nodeTypeName} templates shared by members of your Discourse
                Graphs groups.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label="Close import template panel"
            onClick={onClose}
          >
            <div
              className="icon"
              ref={(el) => (el && setIcon(el, "x")) || undefined}
            />
          </button>
        </div>

        <div className="flex min-h-0 flex-1">
          <div className="min-h-0 w-[min(360px,42%)] shrink-0 overflow-y-auto p-3">
            {isLoading && (
              <div className="text-muted p-3 text-sm">
                Loading shared templates...
              </div>
            )}
            {!isLoading && error && (
              <div className="text-error p-3 text-sm">{error}</div>
            )}
            {!isLoading && !error && candidates.length === 0 && (
              <div className="text-muted p-3 text-sm">
                No new shared templates available for node type {nodeTypeName}.
                Already imported templates are hidden here.
              </div>
            )}
            {!isLoading &&
              !error &&
              candidates.map((candidate) => {
                const isSelected = candidate.id === selectedCandidate?.id;
                return (
                  <div
                    key={candidate.id}
                    className={`mb-2 flex w-full cursor-pointer flex-col gap-1.5 rounded-lg border p-3 text-left text-sm ${
                      isSelected
                        ? "border-accent bg-accent/10"
                        : "border-modifier-border hover:bg-secondary"
                    }`}
                    onClick={() => onSelectCandidate(candidate.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelectCandidate(candidate.id);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <span className="line-clamp-2 text-base font-semibold">
                      {candidate.templateName}.md
                    </span>
                    {candidate.authorName && (
                      <span className="text-muted truncate text-xs">
                        {candidate.authorName}
                      </span>
                    )}
                    <span className="text-muted flex min-w-0 items-center gap-1.5 text-xs">
                      <span
                        className="icon h-3.5 w-3.5 shrink-0"
                        ref={(el) => (el && setIcon(el, "folder")) || undefined}
                      />
                      <span className="max-w-40 truncate rounded bg-secondary px-1.5 py-0.5">
                        {candidate.spaceName}
                      </span>
                      <span aria-hidden="true">-</span>
                      <span>{formatRelativeTime(candidate.lastModified)}</span>
                    </span>
                  </div>
                );
              })}
          </div>

          <div className="h-full w-px bg-[var(--background-modifier-border)]" />

          <div className="flex min-h-0 flex-1 flex-col p-5">
            {selectedCandidate ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <h4 className="mb-4 shrink-0 text-base font-semibold">
                  {selectedCandidate.templateName}.md
                </h4>
                <MarkdownTemplatePreview
                  app={app}
                  templateContent={selectedCandidate.templateContent}
                  sourcePath={`${templateFolderPath}/${selectedCandidate.templateName}.md`}
                  className="min-h-0 flex-1 overflow-y-auto"
                />
              </div>
            ) : (
              <div className="text-muted p-4 text-sm">
                Select a shared template to preview its content.
              </div>
            )}
          </div>
        </div>

        <div className="border-modifier-border flex items-center justify-between gap-3 border-t p-4">
          <div className="text-muted flex items-center gap-1.5 text-sm">
            <span
              className="icon h-3.5 w-3.5 shrink-0"
              ref={(el) => (el && setIcon(el, "info")) || undefined}
            />
            <span>
              Imports a copy to{" "}
              <span className="font-medium">{templateFolderPath}</span> and
              auto-renames on conflict.
            </span>
          </div>
          <button
            type="button"
            className="!bg-accent !text-on-accent flex items-center gap-1.5 rounded px-4 py-2"
            disabled={!selectedCandidate || isImporting}
            onClick={onImport}
          >
            {!isImporting && (
              <span
                className="icon h-4 w-4"
                ref={(el) => (el && setIcon(el, "download")) || undefined}
              />
            )}
            <span>{isImporting ? "Importing..." : "Import & use"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const NodeTypeSettings = () => {
  const plugin = usePlugin();
  const [nodeTypes, setNodeTypes] = useState<DiscourseNode[]>([]);
  const [editingNodeType, setEditingNodeType] = useState<DiscourseNode | null>(
    null,
  );
  const [errors, setErrors] = useState<
    Partial<Record<EditableFieldKey, string>>
  >({});
  const [templateFiles, setTemplateFiles] = useState<string[]>([]);
  const [templateConfig, setTemplateConfig] = useState({
    isEnabled: false,
    folderPath: "",
  });
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(
    null,
  );
  const [isTemplateImportOpen, setIsTemplateImportOpen] = useState(false);
  const [templateImportCandidates, setTemplateImportCandidates] = useState<
    TemplateImportCandidate[]
  >([]);
  const [selectedTemplateCandidateId, setSelectedTemplateCandidateId] =
    useState<number | null>(null);
  const [isLoadingTemplateImports, setIsLoadingTemplateImports] =
    useState(false);
  const [isImportingTemplate, setIsImportingTemplate] = useState(false);
  const [templateImportError, setTemplateImportError] = useState<string>();
  // Ref to always have the latest editing state for onBlur handlers
  const editingRef = useRef<DiscourseNode | null>(null);

  const refreshTemplateFiles = useCallback((): void => {
    const config = getTemplatePluginInfo(plugin.app);
    setTemplateConfig(config);

    const files = getTemplateFiles(plugin.app);
    setTemplateFiles(files);
  }, [plugin.app]);

  useEffect(() => {
    refreshTemplateFiles();
  }, [refreshTemplateFiles]);

  useEffect(() => {
    setNodeTypes(plugin.settings.nodeTypes ?? []);
  }, [plugin.settings.nodeTypes]);

  const validateField = (
    field: EditableFieldKey,
    value: string,
    nodeType: DiscourseNode,
  ): boolean => {
    const fieldConfig = FIELD_CONFIGS[field];
    if (!fieldConfig) return true;

    if (fieldConfig.required && !value.trim()) {
      setErrors((prev) => ({
        ...prev,
        [field]: `${fieldConfig.label} is required`,
      }));
      return false;
    }

    if (fieldConfig.validate) {
      const { isValid, error } = fieldConfig.validate(
        value,
        nodeType,
        nodeTypes,
      );
      if (!isValid) {
        setErrors((prev) => ({
          ...prev,
          [field]: error || `Invalid ${fieldConfig.label.toLowerCase()}`,
        }));
        return false;
      }
    }

    setErrors((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- we don't need the field value
      const { [field]: _, ...rest } = prev;
      return rest;
    });
    return true;
  };

  const validateNodeType = (nodeType: DiscourseNode): boolean => {
    let isValid = true;
    const newErrors: Partial<Record<EditableFieldKey, string>> = {};

    Object.entries(FIELD_CONFIGS).forEach(([key, config]) => {
      const field = key as EditableFieldKey;
      const value = nodeType[field] as string;

      if (config.required && !value?.trim()) {
        newErrors[field] = `${config.label} is required`;
        isValid = false;
        return;
      }

      if (config.validate && value) {
        const { isValid: fieldValid, error } = config.validate(
          value,
          nodeType,
          nodeTypes,
        );
        if (!fieldValid) {
          newErrors[field] = error || `Invalid ${config.label.toLowerCase()}`;
          isValid = false;
        }
      }
    });

    setErrors(newErrors);
    return isValid;
  };

  const saveSettings = (nodeTypeToSave: DiscourseNode) => {
    if (!validateNodeType(nodeTypeToSave)) return;

    const updatedNodeTypes = [...nodeTypes];
    if (
      selectedNodeIndex !== null &&
      selectedNodeIndex < updatedNodeTypes.length
    ) {
      updatedNodeTypes[selectedNodeIndex] = nodeTypeToSave;
    } else {
      updatedNodeTypes.push(nodeTypeToSave);
      setSelectedNodeIndex(updatedNodeTypes.length - 1);
    }

    plugin.settings.nodeTypes = updatedNodeTypes;
    setNodeTypes(updatedNodeTypes);
    void plugin.saveSettings();
  };

  const handleNodeTypeChange = (
    field: EditableFieldKey,
    value: string | boolean,
  ): DiscourseNode | null => {
    if (!editingNodeType) return null;

    const updatedNodeType = {
      ...editingNodeType,
      [field]: value,
      modified: new Date().getTime(),
    };
    if (typeof value === "string") {
      validateField(field, value, updatedNodeType);
    }
    setEditingNodeType(updatedNodeType);
    editingRef.current = updatedNodeType;
    return updatedNodeType;
  };

  const handleAddNodeType = (): void => {
    const now = new Date().getTime();
    const newNodeType: DiscourseNode = {
      id: generateUid("node"),
      name: "",
      format: "",
      template: "",
      tag: "",
      color: "#808080",
      created: now,
      modified: now,
    };
    setEditingNodeType(newNodeType);
    editingRef.current = newNodeType;
    setSelectedNodeIndex(nodeTypes.length);
    setErrors({});
  };

  const startEditing = (index: number) => {
    const nodeType = nodeTypes[index];
    if (nodeType) {
      setEditingNodeType({ ...nodeType });
      editingRef.current = { ...nodeType };
      setSelectedNodeIndex(index);
      setErrors({});
    }
  };

  const handleBack = (): void => {
    setEditingNodeType(null);
    editingRef.current = null;
    setSelectedNodeIndex(null);
    setErrors({});
  };

  const confirmDeleteNodeType = (index: number): void => {
    const nodeType = nodeTypes[index] || { name: "Unnamed" };
    const modal = new ConfirmationModal(plugin.app, {
      title: "Delete node type",
      message: `Are you sure you want to delete the node type "${nodeType.name}"?`,
      onConfirm: () => void handleDeleteNodeType(index),
    });
    modal.open();
  };

  const handleDeleteNodeType = async (index: number): Promise<void> => {
    const nodeType = nodeTypes[index];
    if (!nodeType) return;

    const isUsed = plugin.settings.discourseRelations?.some(
      (rel) =>
        rel.sourceId === nodeType.id || rel.destinationId === nodeType.id,
    );

    if (isUsed) {
      new Notice(
        "Cannot delete this node type as it is used in one or more relations.",
      );
      return;
    }

    const updatedNodeTypes = nodeTypes.filter((_, i) => i !== index);
    plugin.settings.nodeTypes = updatedNodeTypes;
    await plugin.saveSettings();
    setNodeTypes(updatedNodeTypes);
    setSelectedNodeIndex(null);
    setEditingNodeType(null);
    editingRef.current = null;
    new Notice("Node type deleted successfully");
  };

  const isEditingImported = getImportInfo(
    editingNodeType?.importedFromRid,
  ).isImported;

  const handleBlur = () => {
    if (editingRef.current) saveSettings(editingRef.current);
  };

  const openTemplateImportPanel = async (): Promise<void> => {
    if (!editingNodeType) return;

    if (!templateConfig.isEnabled || !templateConfig.folderPath) {
      new Notice("Configure and enable the Obsidian templates plugin first.");
      return;
    }

    if (!editingNodeType.name.trim()) {
      new Notice("Name this node type before importing shared templates.");
      return;
    }

    if (!plugin.settings.syncModeEnabled) {
      new Notice("Enable sync mode before importing shared templates.");
      return;
    }

    setIsTemplateImportOpen(true);
    setIsLoadingTemplateImports(true);
    setTemplateImportError(undefined);
    setTemplateImportCandidates([]);
    setSelectedTemplateCandidateId(null);

    try {
      const candidates = await fetchTemplateImportCandidates({
        plugin,
        nodeTypeName: editingNodeType.name,
      });
      const existingTemplateNames = new Set(
        getTemplateFiles(plugin.app).map((templateFileName) =>
          templateFileName.toLowerCase(),
        ),
      );
      const filteredCandidates = candidates.filter((candidate) => {
        const importedTemplateName = getImportedTemplateFileName({
          templateName: candidate.templateName,
          sourceName: candidate.spaceName,
        });
        return !existingTemplateNames.has(importedTemplateName.toLowerCase());
      });

      setTemplateImportCandidates(filteredCandidates);
      setSelectedTemplateCandidateId(filteredCandidates[0]?.id ?? null);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setTemplateImportError(errorMessage);
      new Notice(`Failed to load shared templates: ${errorMessage}`, 5000);
    } finally {
      setIsLoadingTemplateImports(false);
    }
  };

  const closeTemplateImportPanel = (): void => {
    if (isImportingTemplate) return;

    setIsTemplateImportOpen(false);
    setTemplateImportCandidates([]);
    setSelectedTemplateCandidateId(null);
    setTemplateImportError(undefined);
  };

  const importSelectedTemplate = async (): Promise<void> => {
    if (!editingRef.current) return;

    const selectedCandidate = templateImportCandidates.find(
      (candidate) => candidate.id === selectedTemplateCandidateId,
    );
    if (!selectedCandidate) return;

    setIsImportingTemplate(true);
    try {
      const result = await createTemplateFileWithUniqueName({
        app: plugin.app,
        templateName: selectedCandidate.templateName,
        sourceName: selectedCandidate.spaceName,
        content: selectedCandidate.templateContent,
      });

      if (!result.created) {
        new Notice(`Template import failed: ${result.reason}`, 5000);
        return;
      }

      const updatedNodeType = {
        ...editingRef.current,
        template: result.templateName,
        modified: new Date().getTime(),
      };
      setEditingNodeType(updatedNodeType);
      editingRef.current = updatedNodeType;
      saveSettings(updatedNodeType);
      refreshTemplateFiles();
      setIsTemplateImportOpen(false);
      new Notice(`Imported and selected "${result.templateName}.md"`, 3000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Error importing shared template:", error);
      new Notice(`Template import failed: ${errorMessage}`, 5000);
    } finally {
      setIsImportingTemplate(false);
    }
  };

  const renderField = (fieldConfig: BaseFieldConfig) => {
    if (!editingNodeType) return null;

    const value = editingNodeType[fieldConfig.key] as string | boolean;
    const error = errors[fieldConfig.key];

    // Text fields: update local state on change, save on blur
    // Discrete fields (color, boolean, select): update + save on change
    const handleChange = (newValue: string | boolean) => {
      const updated = handleNodeTypeChange(fieldConfig.key, newValue);
      if (fieldConfig.type !== "text" && updated) {
        saveSettings(updated);
      }
    };

    return (
      <FieldWrapper
        fieldConfig={fieldConfig}
        error={error}
        key={fieldConfig.key}
      >
        {fieldConfig.key === "template" ? (
          <TemplateField
            value={value as string}
            error={error}
            onChange={handleChange}
            templateConfig={templateConfig}
            templateFiles={templateFiles}
            disabled={isEditingImported}
            onImportClick={() => {
              void openTemplateImportPanel();
            }}
            importDisabledReason={
              !editingNodeType.name.trim()
                ? "Name this node type before importing shared templates."
                : !plugin.settings.syncModeEnabled
                  ? "Enable sync mode before importing shared templates."
                  : undefined
            }
          />
        ) : fieldConfig.type === "color" ? (
          <ColorField
            value={value as string}
            error={error}
            onChange={handleChange}
            disabled={isEditingImported}
          />
        ) : fieldConfig.type === "boolean" ? (
          <BooleanField
            value={value as boolean}
            onChange={handleChange}
            disabled={isEditingImported}
          />
        ) : (
          <TextField
            fieldConfig={fieldConfig}
            value={value as string}
            error={error}
            onChange={handleChange}
            onBlur={handleBlur}
            nodeType={editingNodeType}
            disabled={isEditingImported}
          />
        )}
      </FieldWrapper>
    );
  };

  const renderNodeList = () => {
    const localNodeTypes = nodeTypes.filter(
      (nodeType) => !nodeType.importedFromRid,
    );
    const importedNodeTypes = nodeTypes.filter(
      (nodeType) => nodeType.importedFromRid,
    );

    const renderNodeTypeItem = (nodeType: DiscourseNode, index: number) => {
      const importInfo = getImportInfo(nodeType.importedFromRid);
      const isImported = importInfo.isImported;

      return (
        <div
          key={nodeType.id}
          className="node-type-item hover:bg-secondary-lt flex cursor-pointer flex-col gap-1 p-2"
          onClick={() => startEditing(index)}
        >
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                {nodeType.color && (
                  <div
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: nodeType.color }}
                  />
                )}
                <span>{nodeType.name}</span>
              </div>
              {isImported && importInfo.spaceUri && (
                <span className="text-muted pl-6 text-xs">
                  {nodeType.authorId &&
                    `by ${getUserNameById(plugin, nodeType.authorId)} `}
                  from{" "}
                  {formatImportSource(
                    importInfo.spaceUri || "",
                    plugin.settings.spaceNames,
                  )}
                </span>
              )}
            </div>
            {!isImported && (
              <div className="flex gap-2">
                <button
                  className="icon-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(index);
                  }}
                  aria-label="Edit node type"
                >
                  <div
                    className="icon"
                    ref={(el) => (el && setIcon(el, "pencil")) || undefined}
                  />
                </button>
                <button
                  className="icon-button mod-warning"
                  onClick={(e) => {
                    e.stopPropagation();
                    confirmDeleteNodeType(index);
                  }}
                  aria-label="Delete node type"
                >
                  <div
                    className="icon"
                    ref={(el) => (el && setIcon(el, "trash")) || undefined}
                  />
                </button>
              </div>
            )}
          </div>
          {nodeType.description && (
            <span className="text-muted text-sm">{nodeType.description}</span>
          )}
        </div>
      );
    };

    return (
      <div className="node-type-list">
        <button onClick={handleAddNodeType} className="mod-cta">
          Add node type
        </button>

        {localNodeTypes.length > 0 && (
          <div className="mt-4">
            {importedNodeTypes.length > 0 && (
              <h4 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
                Local
              </h4>
            )}
            <div className="flex flex-col gap-0.5">
              {localNodeTypes.map((nodeType) => {
                const index = nodeTypes.indexOf(nodeType);
                return renderNodeTypeItem(nodeType, index);
              })}
            </div>
          </div>
        )}

        {importedNodeTypes.length > 0 && (
          <div className="border-modifier-border mt-6 border-t pt-4">
            <h4 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
              Imported
            </h4>
            <div className="border-modifier-border flex flex-col gap-0.5 rounded border bg-secondary p-2">
              {importedNodeTypes.map((nodeType) => {
                const index = nodeTypes.indexOf(nodeType);
                return renderNodeTypeItem(nodeType, index);
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderEditForm = () => {
    if (!editingNodeType) return null;

    return (
      <div>
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={handleBack}
            className="icon-button"
            aria-label="Back to node type list"
          >
            <div
              className="icon"
              ref={(el) => (el && setIcon(el, "arrow-left")) || undefined}
            />
          </button>
          <h3 className="dg-h3">
            {isEditingImported
              ? `[Read only] Imported from ${getAndFormatImportSource(editingNodeType.importedFromRid || "", plugin.settings.spaceNames)}`
              : "Edit node type"}
          </h3>
        </div>
        {FIELD_CONFIG_ARRAY.map(renderField)}
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-name">Folder path</div>
            <div className="setting-item-description">
              Folder where new nodes of this type will be created. Leave empty
              to use the default discourse nodes folder path from general
              settings.
            </div>
          </div>
          <div className="setting-item-control">
            <FolderSuggestInput
              value={editingNodeType.folderPath || ""}
              onChange={(value) => {
                const updated = handleNodeTypeChange("folderPath", value);
                if (updated) saveSettings(updated);
              }}
              placeholder="Example: folder 1/folder"
              disabled={isEditingImported}
            />
          </div>
        </div>
        {selectedNodeIndex !== null && selectedNodeIndex < nodeTypes.length && (
          <div className="setting-item">
            <div className="setting-item-info">
              <div className="setting-item-name">Base view</div>
              <div className="setting-item-description">
                Create a new Base view filtered to this node type
              </div>
            </div>
            <div className="setting-item-control">
              <button
                onClick={() =>
                  void createBaseForNodeType(plugin, editingNodeType)
                }
              >
                Create Base view
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="discourse-graph">
      {selectedNodeIndex === null ? renderNodeList() : renderEditForm()}
      {isTemplateImportOpen && editingNodeType && (
        <TemplateImportPanel
          app={plugin.app}
          nodeTypeName={editingNodeType.name}
          candidates={templateImportCandidates}
          selectedCandidateId={selectedTemplateCandidateId}
          isLoading={isLoadingTemplateImports}
          isImporting={isImportingTemplate}
          error={templateImportError}
          templateFolderPath={templateConfig.folderPath}
          onSelectCandidate={setSelectedTemplateCandidateId}
          onClose={closeTemplateImportPanel}
          onImport={() => {
            void importSelectedTemplate();
          }}
        />
      )}
    </div>
  );
};

export default NodeTypeSettings;
