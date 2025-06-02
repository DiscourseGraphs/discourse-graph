import { useState, useEffect } from "react";
import {
  validateAllNodes,
  validateNodeFormat,
  validateNodeName,
} from "~/utils/validateNodeType";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";
import generateUid from "~/utils/generateUid";
import { DiscourseNode } from "~/types";
import { ConfirmationModal } from "./ConfirmationModal";
import { getTemplateFiles, getTemplatePluginInfo } from "~/utils/templates";

const NodeTypeSettings = () => {
  const plugin = usePlugin();
  const [nodeTypes, setNodeTypes] = useState(
    () => plugin.settings.nodeTypes ?? [],
  );
  const [formatErrors, setFormatErrors] = useState<Record<number, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [templateFiles, setTemplateFiles] = useState<string[]>([]);
  const [templateConfig, setTemplateConfig] = useState({
    isEnabled: false,
    folderPath: "",
  });

  useEffect(() => {
    const config = getTemplatePluginInfo(plugin.app);
    setTemplateConfig(config);

    const files = getTemplateFiles(plugin.app);
    setTemplateFiles(files);
  }, [plugin.app]);

  const updateErrors = (
    index: number,
    validation: { isValid: boolean; error?: string },
  ) => {
    if (!validation.isValid) {
      setFormatErrors((prev) => ({
        ...prev,
        [index]: validation.error || "Invalid input",
      }));
    } else {
      setFormatErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
  };

  const handleNodeTypeChange = async (
    index: number,
    field: keyof DiscourseNode,
    value: string,
  ): Promise<void> => {
    const updatedNodeTypes = [...nodeTypes];
    if (!updatedNodeTypes[index]) {
      const newId = generateUid("node");
      updatedNodeTypes[index] = {
        id: newId,
        name: "",
        format: "",
        template: "",
      };
    }

    updatedNodeTypes[index][field] = value;

    if (field === "format") {
      const { isValid, error } = validateNodeFormat(value, updatedNodeTypes);
      updateErrors(index, { isValid, error });
    } else if (field === "name") {
      const nameValidation = validateNodeName(value, updatedNodeTypes);
      updateErrors(index, nameValidation);
    }

    setNodeTypes(updatedNodeTypes);
    setHasUnsavedChanges(true);
  };

  const handleAddNodeType = (): void => {
    const newId = generateUid("node");
    const updatedNodeTypes = [
      ...nodeTypes,
      {
        id: newId,
        name: "",
        format: "",
        template: "",
      },
    ];
    setNodeTypes(updatedNodeTypes);
    setHasUnsavedChanges(true);
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
    const nodeId = nodeTypes[index]?.id;
    const isUsed = plugin.settings.discourseRelations?.some(
      (rel) => rel.sourceId === nodeId || rel.destinationId === nodeId,
    );

    if (isUsed) {
      new Notice(
        "Cannot delete this node type as it is used in one or more relations.",
      );
      return;
    }

    const updatedNodeTypes = nodeTypes.filter((_, i) => i !== index);
    setNodeTypes(updatedNodeTypes);
    plugin.settings.nodeTypes = updatedNodeTypes;
    await plugin.saveSettings();
    if (formatErrors[index]) {
      setFormatErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[index];
        return newErrors;
      });
    }
    new Notice("Node type deleted successfully");
  };

  const handleSave = async (): Promise<void> => {
    const { hasErrors, errorMap } = validateAllNodes(nodeTypes);

    if (hasErrors) {
      setFormatErrors(errorMap);
      new Notice("Please fix the errors before saving");
      return;
    }
    plugin.settings.nodeTypes = nodeTypes;
    await plugin.saveSettings();
    new Notice("Node types saved");
    setHasUnsavedChanges(false);
  };

  return (
    <div>
      <div className="discourse-graph">
        <h3 className="dg-h3">Node Types</h3>
      </div>
      {nodeTypes.map((nodeType, index) => (
        <div key={index} className="setting-item">
          <div className="flex w-full flex-col">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Name"
                value={nodeType.name}
                onChange={(e) =>
                  handleNodeTypeChange(index, "name", e.target.value)
                }
                className="flex-2"
              />
              <input
                type="text"
                placeholder="Format (e.g., CLM - {content})"
                value={nodeType.format}
                onChange={(e) =>
                  handleNodeTypeChange(index, "format", e.target.value)
                }
                className="flex-1"
              />
              <select
                value={nodeType.template || ""}
                onChange={(e) =>
                  handleNodeTypeChange(index, "template", e.target.value)
                }
                className="flex-1"
                disabled={
                  !templateConfig.isEnabled || !templateConfig.folderPath
                }
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
              <button
                onClick={() => confirmDeleteNodeType(index)}
                className="mod-warning p-2"
              >
                Delete
              </button>
            </div>
            {formatErrors[index] && (
              <div className="text-error mt-1 text-xs">
                {formatErrors[index]}
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="setting-item">
        <div className="flex gap-2">
          <button onClick={handleAddNodeType} className="p-2">
            Add Node Type
          </button>
          <button
            onClick={handleSave}
            className={`p-2 ${hasUnsavedChanges ? "mod-cta" : ""}`}
            disabled={
              !hasUnsavedChanges || Object.keys(formatErrors).length > 0
            }
          >
            Save Changes
          </button>
        </div>
      </div>
      {hasUnsavedChanges && (
        <div className="text-muted mt-2">You have unsaved changes</div>
      )}
    </div>
  );
};

export default NodeTypeSettings;
