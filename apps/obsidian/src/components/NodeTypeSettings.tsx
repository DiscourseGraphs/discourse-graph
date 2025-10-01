import { useState, useEffect } from "react";
import { validateNodeFormat, validateNodeName } from "~/utils/validateNodeType";
import { usePlugin } from "./PluginContext";
import { Notice, setIcon } from "obsidian";
import generateUid from "~/utils/generateUid";
import { DiscourseNode } from "~/types";
import { ConfirmationModal } from "./ConfirmationModal";
import { getTemplateFiles, getTemplatePluginInfo } from "~/utils/templates";

type EditableFieldKey = keyof Omit<DiscourseNode, "id" | "shortcut">;

type BaseFieldConfig = {
  key: EditableFieldKey;
  label: string;
  description: string;
  required?: boolean;
  type: "text" | "select" | "color";
  placeholder?: string;
  validate?: (
    value: string,
    nodeType: DiscourseNode,
    existingNodes: DiscourseNode[],
  ) => { isValid: boolean; error?: string };
};

const FIELD_CONFIGS: Record<EditableFieldKey, BaseFieldConfig> = {
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
    placeholder: "Enter tag (e.g., #clm-candidate)",
    validate: (value) => {
      if (!value.trim()) return { isValid: true };
      if (!value.startsWith("#")) {
        return { isValid: false, error: "Tag must start with #" };
      }
      if (/\s/.test(value)) {
        return { isValid: false, error: "Tag cannot contain spaces" };
      }
      return { isValid: true };
    },
  },
};

const FIELD_CONFIG_ARRAY = Object.values(FIELD_CONFIGS);

const TextField = ({
  fieldConfig,
  value,
  error,
  onChange,
}: {
  fieldConfig: BaseFieldConfig;
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) => (
  <input
    type="text"
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    placeholder={fieldConfig.placeholder}
    className={`w-full ${error ? "input-error" : ""}`}
  />
);

const ColorField = ({
  value,
  error,
  onChange,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
}) => (
  <input
    type="color"
    value={value || "#000000"}
    onChange={(e) => onChange(e.target.value)}
    className={`h-8 w-20 ${error ? "input-error" : ""}`}
  />
);

const TemplateField = ({
  value,
  error,
  onChange,
  templateConfig,
  templateFiles,
}: {
  value: string;
  error?: string;
  onChange: (value: string) => void;
  templateConfig: { isEnabled: boolean; folderPath: string };
  templateFiles: string[];
}) => (
  <select
    value={value || ""}
    onChange={(e) => onChange(e.target.value)}
    className={`w-full ${error ? "input-error" : ""}`}
    disabled={!templateConfig.isEnabled || !templateConfig.folderPath}
  >
    <option value="">
      {!templateConfig.isEnabled || !templateConfig.folderPath
        ? "Template folder not configured"
        : "No template"}
    </option>
    {templateFiles.map((templateFile) => (
      <option key={templateFile} value={templateFile}>
        {templateFile}
      </option>
    ))}
  </select>
);

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
      {children}
      {error && <div className="text-error mt-1 text-xs">{error}</div>}
    </div>
  </div>
);

const NodeTypeSettings = () => {
  const plugin = usePlugin();
  const [nodeTypes, setNodeTypes] = useState<DiscourseNode[]>([]);
  const [editingNodeType, setEditingNodeType] = useState<DiscourseNode | null>(
    null,
  );
  const [errors, setErrors] = useState<
    Partial<Record<EditableFieldKey, string>>
  >({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [templateFiles, setTemplateFiles] = useState<string[]>([]);
  const [templateConfig, setTemplateConfig] = useState({
    isEnabled: false,
    folderPath: "",
  });
  const [selectedNodeIndex, setSelectedNodeIndex] = useState<number | null>(
    null,
  );

  useEffect(() => {
    const config = getTemplatePluginInfo(plugin.app);
    setTemplateConfig(config);

    const files = getTemplateFiles(plugin.app);
    setTemplateFiles(files);
  }, [plugin.app]);

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
      const { [field]: _, ...rest } = prev;
      return rest;
    });
    return true;
  };

  const handleNodeTypeChange = (
    field: EditableFieldKey,
    value: string,
  ): void => {
    if (!editingNodeType) return;

    const updatedNodeType = { ...editingNodeType, [field]: value };
    validateField(field, value, updatedNodeType);
    setEditingNodeType(updatedNodeType);
    setHasUnsavedChanges(true);
  };

  const handleAddNodeType = (): void => {
    const newNodeType: DiscourseNode = {
      id: generateUid("node"),
      name: "",
      format: "",
      template: "",
      tag: "",
    };
    setEditingNodeType(newNodeType);
    setSelectedNodeIndex(nodeTypes.length);
    setHasUnsavedChanges(true);
    setErrors({});
  };

  const startEditing = (index: number) => {
    const nodeType = nodeTypes[index];
    if (nodeType) {
      setEditingNodeType({ ...nodeType });
      setSelectedNodeIndex(index);
      setHasUnsavedChanges(false);
      setErrors({});
    }
  };

  const confirmDeleteNodeType = (index: number): void => {
    const nodeType = nodeTypes[index] || { name: "Unnamed" };
    const modal = new ConfirmationModal(plugin.app, {
      title: "Delete Node Type",
      message: `Are you sure you want to delete the node type "${nodeType.name}"?`,
      onConfirm: () => handleDeleteNodeType(index),
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
    new Notice("Node type deleted successfully");
  };

  const handleSave = async (): Promise<void> => {
    if (!editingNodeType) return;

    if (!validateNodeType(editingNodeType)) {
      return;
    }

    const updatedNodeTypes = [...nodeTypes];
    if (
      selectedNodeIndex !== null &&
      selectedNodeIndex < updatedNodeTypes.length
    ) {
      updatedNodeTypes[selectedNodeIndex] = editingNodeType;
    } else {
      updatedNodeTypes.push(editingNodeType);
    }

    plugin.settings.nodeTypes = updatedNodeTypes;
    await plugin.saveSettings();
    setNodeTypes(updatedNodeTypes);
    new Notice("Node type saved");
    setHasUnsavedChanges(false);
    setSelectedNodeIndex(null);
    setEditingNodeType(null);
    setErrors({});
  };

  const handleCancel = (): void => {
    setEditingNodeType(null);
    setSelectedNodeIndex(null);
    setHasUnsavedChanges(false);
    setErrors({});
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

  const renderField = (fieldConfig: BaseFieldConfig) => {
    if (!editingNodeType) return null;

    const value = editingNodeType[fieldConfig.key] as string;
    const error = errors[fieldConfig.key];
    const handleChange = (newValue: string) =>
      handleNodeTypeChange(fieldConfig.key, newValue);

    return (
      <FieldWrapper
        fieldConfig={fieldConfig}
        error={error}
        key={fieldConfig.key}
      >
        {fieldConfig.key === "template" ? (
          <TemplateField
            value={value}
            error={error}
            onChange={handleChange}
            templateConfig={templateConfig}
            templateFiles={templateFiles}
          />
        ) : fieldConfig.type === "color" ? (
          <ColorField value={value} error={error} onChange={handleChange} />
        ) : (
          <TextField
            fieldConfig={fieldConfig}
            value={value}
            error={error}
            onChange={handleChange}
          />
        )}
      </FieldWrapper>
    );
  };

  const renderNodeList = () => (
    <div className="node-type-list">
      <button onClick={handleAddNodeType} className="mod-cta">
        Add Node Type
      </button>
      {nodeTypes.map((nodeType, index) => (
        <div
          key={nodeType.id}
          className="node-type-item hover:bg-secondary-lt flex cursor-pointer flex-col gap-1 p-2"
          onClick={() => startEditing(index)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {nodeType.color && (
                <div
                  className="h-4 w-4 rounded-full"
                  style={{ backgroundColor: nodeType.color }}
                />
              )}
              <span>{nodeType.name}</span>
            </div>
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
          </div>
          {nodeType.description && (
            <span className="text-muted text-sm">{nodeType.description}</span>
          )}
        </div>
      ))}
    </div>
  );

  const renderEditForm = () => {
    if (!editingNodeType) return null;

    return (
      <div>
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={handleCancel}
            className="icon-button"
            aria-label="Back to node type list"
          >
            <div
              className="icon"
              ref={(el) => (el && setIcon(el, "arrow-left")) || undefined}
            />
          </button>
          <h3 className="dg-h3">Edit Node Type</h3>
        </div>
        {FIELD_CONFIG_ARRAY.map(renderField)}
        {hasUnsavedChanges && (
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={handleCancel} className="mod-muted">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="mod-cta"
              disabled={
                Object.keys(errors).length > 0 ||
                !editingNodeType.name ||
                !editingNodeType.format
              }
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="discourse-graph">
      {selectedNodeIndex === null ? renderNodeList() : renderEditForm()}
    </div>
  );
};

export default NodeTypeSettings;
