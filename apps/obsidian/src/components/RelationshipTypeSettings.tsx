import { useState, useEffect } from "react";
import type DiscourseGraphPlugin from "../index";
import { DiscourseRelationType } from "../types";
import { useApp } from "./AppContext";
import { Notice } from "obsidian";

const RelationshipTypeSettings = ({
  plugin,
}: {
  plugin: DiscourseGraphPlugin;
}) => {
  const [relationTypes, setRelationTypes] = useState<DiscourseRelationType[]>(
    () => plugin.settings.relationTypes ?? [],
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const initializeSettings = async () => {
      let needsSave = false;

      if (!plugin.settings.relationTypes) {
        plugin.settings.relationTypes = [];
        needsSave = true;
      }

      if (needsSave) {
        await plugin.saveSettings();
      }
    };

    initializeSettings();
  }, [plugin]);

  const handleRelationTypeChange = async (
    index: number,
    field: keyof DiscourseRelationType,
    value: string,
  ): Promise<void> => {
    const updatedRelationTypes = [...relationTypes];
    if (!updatedRelationTypes[index]) {
      updatedRelationTypes[index] = { id: "", label: "", complement: "" };
    }

    updatedRelationTypes[index][field] = value;
    setRelationTypes(updatedRelationTypes);
    setHasUnsavedChanges(true);
  };

  const handleAddRelationType = (): void => {
    const updatedRelationTypes = [
      ...relationTypes,
      {
        id: "",
        label: "",
        complement: "",
      },
    ];
    setRelationTypes(updatedRelationTypes);
    setHasUnsavedChanges(true);
  };

  const handleDeleteRelationType = async (index: number): Promise<void> => {
    // Check if this relation type is used in any relations
    const isUsed = plugin.settings.discourseRelations?.some(
      (rel) => rel.relationshipType.id === relationTypes[index]?.id,
    );

    if (isUsed) {
      new Notice(
        "Cannot delete this relation type as it is used in one or more relations.",
      );
      return;
    }

    const updatedRelationTypes = relationTypes.filter((_, i) => i !== index);
    setRelationTypes(updatedRelationTypes);
    plugin.settings.relationTypes = updatedRelationTypes;
    await plugin.saveSettings();
    await plugin.loadSettings();
  };

  const handleSave = async (): Promise<void> => {
    // Validate relation types
    for (const relType of relationTypes) {
      if (!relType.id || !relType.label || !relType.complement) {
        new Notice("All fields are required for relation types.");
        return;
      }
    }

    // Check for duplicate IDs
    const ids = relationTypes.map((rt) => rt.id);
    if (new Set(ids).size !== ids.length) {
      new Notice("Relation type IDs must be unique.");
      return;
    }

    plugin.settings.relationTypes = relationTypes;
    await plugin.saveSettings();
    console.log("new relations type", plugin.settings.relationTypes);
    // await plugin.loadSettings();
    setHasUnsavedChanges(false);
  };

  return (
    <div className="discourse-relation-types">
      <h3>Relation Types</h3>
      {relationTypes.map((relationType, index) => (
        <div key={index} className="setting-item">
          <div
            style={{ display: "flex", flexDirection: "column", width: "100%" }}
          >
            <div style={{ display: "flex", gap: "10px" }}>
              <input
                type="text"
                placeholder="ID (e.g., supports)"
                value={relationType.id}
                onChange={(e) =>
                  handleRelationTypeChange(index, "id", e.target.value)
                }
                style={{ flex: 1 }}
              />
              <input
                type="text"
                placeholder="Label (e.g., supports)"
                value={relationType.label}
                onChange={(e) =>
                  handleRelationTypeChange(index, "label", e.target.value)
                }
                style={{ flex: 1 }}
              />
              <input
                type="text"
                placeholder="Complement (e.g., is supported by)"
                value={relationType.complement}
                onChange={(e) =>
                  handleRelationTypeChange(index, "complement", e.target.value)
                }
                style={{ flex: 2 }}
              />
              <button
                onClick={() => handleDeleteRelationType(index)}
                className="mod-warning"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
      <div className="setting-item">
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleAddRelationType}>Add Relation Type</button>
          <button
            onClick={handleSave}
            className={hasUnsavedChanges ? "mod-cta" : ""}
            disabled={!hasUnsavedChanges}
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

export default RelationshipTypeSettings;
