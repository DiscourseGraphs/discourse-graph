import { useState } from "react";
import { DiscourseRelationType } from "~/types";
import { Notice } from "obsidian";
import { usePlugin } from "./PluginContext";
import generateUid from "~/utils/generateUid";
import { ConfirmationModal } from "./ConfirmationModal";

const RelationshipTypeSettings = () => {
  const plugin = usePlugin();
  const [relationTypes, setRelationTypes] = useState<DiscourseRelationType[]>(
    () => plugin.settings.relationTypes ?? [],
  );
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleRelationTypeChange = (
    index: number,
    field: keyof DiscourseRelationType,
    value: string,
  ): void => {
    const updatedRelationTypes = [...relationTypes];
    if (!updatedRelationTypes[index]) {
      const newId = generateUid("rel");
      updatedRelationTypes[index] = {
        id: newId,
        label: "",
        complement: "",
        color: "#000000",
      };
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
        color: "#000000",
      },
    ];
    setRelationTypes(updatedRelationTypes);
    setHasUnsavedChanges(true);
  };

  const confirmDeleteRelationType = (index: number): void => {
    const relationType = relationTypes[index] || {
      label: "Unnamed",
      complement: "",
      color: "#000000",
    };
    const modal = new ConfirmationModal(plugin.app, {
      title: "Delete Relation Type",
      message: `Are you sure you want to delete the relation type "${relationType.label}"?`,
      onConfirm: () => handleDeleteRelationType(index),
    });
    modal.open();
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
    new Notice("Relation type deleted successfully");
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
      {relationTypes.map((relationType, index) => (
        <div key={index} className="setting-item">
          <div className="flex w-full flex-col">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Label (e.g., supports)"
                value={relationType.label}
                onChange={(e) =>
                  handleRelationTypeChange(index, "label", e.target.value)
                }
                className="flex-2"
              />
              <input
                type="text"
                placeholder="Complement (e.g., is supported by)"
                value={relationType.complement}
                onChange={(e) =>
                  handleRelationTypeChange(index, "complement", e.target.value)
                }
                className="flex-1"
              />
              <input
                type="color"
                value={relationType.color}
                onChange={(e) =>
                  handleRelationTypeChange(index, "color", e.target.value)
                }
                className="w-12 h-8 rounded border"
                title="Relation color"
              />
              <button
                onClick={() => confirmDeleteRelationType(index)}
                className="mod-warning p-2"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
      <div className="setting-item">
        <div className="flex gap-2">
          <button onClick={handleAddRelationType} className="p-2">
            Add Relation Type
          </button>
          <button
            onClick={handleSave}
            className={`p-2 ${hasUnsavedChanges ? "mod-cta" : ""}`}
            disabled={!hasUnsavedChanges}
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

export default RelationshipTypeSettings;
