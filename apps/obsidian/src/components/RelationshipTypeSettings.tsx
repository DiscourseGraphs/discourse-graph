import { useState } from "react";
import { DiscourseRelationType } from "../types";
import { Notice } from "obsidian";
import { usePlugin } from "./PluginContext";
import generateUid from "../utils/generateUid";

const RelationshipTypeSettings = () => {
  const plugin = usePlugin();
  const [relationTypes, setRelationTypes] = useState<DiscourseRelationType[]>(
    () => plugin.settings.relationTypes ?? [],
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleRelationTypeChange = async (
    index: number,
    field: keyof DiscourseRelationType,
    value: string,
  ): Promise<void> => {
    const updatedRelationTypes = [...relationTypes];
    if (!updatedRelationTypes[index]) {
      const newId = generateUid("rel");
      updatedRelationTypes[index] = { id: newId, label: "", complement: "" };
    }

    updatedRelationTypes[index][field] = value;
    setRelationTypes(updatedRelationTypes);
    setHasUnsavedChanges(true);
  };

  const handleAddRelationType = (): void => {
    const newId = generateUid("rel");

    const updatedRelationTypes = [
      ...relationTypes,
      {
        id: newId,
        label: "",
        complement: "",
      },
    ];
    setRelationTypes(updatedRelationTypes);
    setHasUnsavedChanges(true);
  };

  const handleDeleteRelationType = async (index: number): Promise<void> => {
    const isUsed = plugin.settings.discourseRelations?.some(
      (rel) => rel.relationshipTypeId === relationTypes[index]?.id,
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
  };

  const handleSave = async (): Promise<void> => {
    for (const relType of relationTypes) {
      if (!relType.id || !relType.label || !relType.complement) {
        new Notice("All fields are required for relation types.");
        return;
      }
    }

    const labels = relationTypes.map((rt) => rt.label);
    if (new Set(labels).size !== labels.length) {
      new Notice("Relation type labels must be unique.");
      return;
    }

    const complements = relationTypes.map((rt) => rt.complement);
    if (new Set(complements).size !== complements.length) {
      new Notice("Relation type complements must be unique.");
      return;
    }

    plugin.settings.relationTypes = relationTypes;
    await plugin.saveSettings();
    setHasUnsavedChanges(false);
    new Notice("Relation types saved.");
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
