import { useState } from "react";
import {
  validateAllNodes,
  validateNodeFormat,
  validateNodeName,
} from "../utils/validateNodeFormat";
import { usePlugin } from "./PluginContext";
import { Notice } from "obsidian";
import generateUid from "~/utils/generateUid";
import { DiscourseNode } from "~/types";

const NodeTypeSettings = () => {
  const plugin = usePlugin();
  const [nodeTypes, setNodeTypes] = useState(
    () => plugin.settings.nodeTypes ?? [],
  );
  const [formatErrors, setFormatErrors] = useState<Record<number, string>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleNodeTypeChange = async (
    index: number,
    field: keyof DiscourseNode,
    value: string,
  ): Promise<void> => {
    const updatedNodeTypes = [...nodeTypes];
    if (!updatedNodeTypes[index]) {
      const newId = generateUid("node");
      updatedNodeTypes[index] = { id: newId, name: "", format: "" };
    }

    updatedNodeTypes[index][field] = value;

    if (field === "format") {
      const { isValid, error } = validateNodeFormat(value, updatedNodeTypes);
      if (!isValid) {
        setFormatErrors((prev) => ({
          ...prev,
          [index]: error || "Invalid format",
        }));
      } else {
        setFormatErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[index];
          return newErrors;
        });
      }
    } else if (field === "name") {
      const nameValidation = validateNodeName(value, updatedNodeTypes);
      if (!nameValidation.isValid) {
        setFormatErrors((prev) => ({
          ...prev,
          [index]: nameValidation.error || "Invalid name",
        }));
      } else {
        setFormatErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[index];
          return newErrors;
        });
      }
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
      },
    ];
    setNodeTypes(updatedNodeTypes);
    setHasUnsavedChanges(true);
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
    <div className="discourse-node-types">
      <h3>Node Types</h3>
      {nodeTypes.map((nodeType, index) => (
        <div key={index} className="setting-item">
          <div
            style={{ display: "flex", flexDirection: "column", width: "100%" }}
          >
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="Name"
                value={nodeType.name}
                onChange={(e) =>
                  handleNodeTypeChange(index, "name", e.target.value)
                }
                style={{ flex: 1 }}
              />
              <input
                type="text"
                placeholder="Format (e.g., [CLM] - {content})"
                value={nodeType.format}
                onChange={(e) =>
                  handleNodeTypeChange(index, "format", e.target.value)
                }
                style={{ flex: 2 }}
              />
              <button
                onClick={() => handleDeleteNodeType(index)}
                className="mod-warning"
              >
                Delete
              </button>
            </div>
            {formatErrors[index] && (
              <div
                style={{
                  color: "var(--text-error)",
                  fontSize: "12px",
                  marginTop: "4px",
                }}
              >
                {formatErrors[index]}
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="setting-item">
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleAddNodeType}>Add Node Type</button>
          <button
            onClick={handleSave}
            className={hasUnsavedChanges ? "mod-cta" : ""}
            disabled={
              !hasUnsavedChanges || Object.keys(formatErrors).length > 0
            }
          >
            Save Changes
          </button>
        </div>
      </div>
      {hasUnsavedChanges && (
        <div style={{ marginTop: "8px", color: "var(--text-muted)" }}>
          You have unsaved changes
        </div>
      )}
    </div>
  );
};

export default NodeTypeSettings;
