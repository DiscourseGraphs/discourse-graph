import { useState } from "react";
import {
  DiscourseRelation,
  DiscourseNode,
  DiscourseRelationType,
} from "~/types";
import { Notice } from "obsidian";
import { usePlugin } from "./PluginContext";
import { ConfirmationModal } from "./ConfirmationModal";

const RelationshipSettings = () => {
  const plugin = usePlugin();
  const [discourseRelations, setDiscourseRelations] = useState<
    DiscourseRelation[]
  >(() => plugin.settings.discourseRelations ?? []);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const findNodeById = (id: string): DiscourseNode | undefined => {
    return plugin.settings.nodeTypes.find((node) => node.id === id);
  };

  const findRelationTypeById = (
    id: string,
  ): DiscourseRelationType | undefined => {
    return plugin.settings.relationTypes.find((relType) => relType.id === id);
  };

  const handleRelationChange = async (
    index: number,
    field: keyof DiscourseRelation,
    value: string,
  ): Promise<void> => {
    const updatedRelations = [...discourseRelations];

    if (!updatedRelations[index]) {
      updatedRelations[index] = {
        sourceId: "",
        destinationId: "",
        relationshipTypeId: "",
      };
    }

    updatedRelations[index][field] = value;
    setDiscourseRelations(updatedRelations);
    setHasUnsavedChanges(true);
  };

  const handleAddRelation = (): void => {
    const updatedRelations = [
      ...discourseRelations,
      {
        sourceId: "",
        destinationId: "",
        relationshipTypeId: "",
      },
    ];
    setDiscourseRelations(updatedRelations);
    setHasUnsavedChanges(true);
  };

  const confirmDeleteRelation = (index: number): void => {
    const relation = discourseRelations[index] || {
      sourceId: "",
      destinationId: "",
      relationshipTypeId: "",
    };
    let message = "Are you sure you want to delete this relation?";

    // If the relation has source and target nodes, provide more context
    if (
      relation.sourceId &&
      relation.destinationId &&
      relation.relationshipTypeId
    ) {
      const sourceNode = findNodeById(relation.sourceId);
      const targetNode = findNodeById(relation.destinationId);
      const relationType = findRelationTypeById(relation.relationshipTypeId);

      if (sourceNode && targetNode && relationType) {
        message = `Are you sure you want to delete the relation between "${sourceNode.name}" and "${targetNode.name}" (${relationType.label})?`;
      }
    }

    const modal = new ConfirmationModal(plugin.app, {
      title: "Delete Relation",
      message,
      onConfirm: () => handleDeleteRelation(index),
    });
    modal.open();
  };

  const handleDeleteRelation = async (index: number): Promise<void> => {
    const updatedRelations = discourseRelations.filter((_, i) => i !== index);
    setDiscourseRelations(updatedRelations);
    plugin.settings.discourseRelations = updatedRelations;
    await plugin.saveSettings();
    new Notice("Relation deleted");
  };

  const handleSave = async (): Promise<void> => {
    for (const relation of discourseRelations) {
      if (
        !relation.relationshipTypeId ||
        !relation.sourceId ||
        !relation.destinationId
      ) {
        new Notice("All fields are required for relations.");
        return;
      }
    }

    const relationKeys = discourseRelations.map(
      (r) => `${r.relationshipTypeId}-${r.sourceId}-${r.destinationId}`,
    );
    if (new Set(relationKeys).size !== relationKeys.length) {
      new Notice("Duplicate relations are not allowed.");
      return;
    }

    plugin.settings.discourseRelations = discourseRelations;
    await plugin.saveSettings();
    new Notice("Relations saved");
    setHasUnsavedChanges(false);
  };

  return (
    <div className="discourse-relations">
      <div className="discourse-graph">
        <h3 className="dg-h3">Node Type Relations</h3>
      </div>

      {plugin.settings.nodeTypes.length === 0 ? (
        <div>You need to create some node types first.</div>
      ) : plugin.settings.relationTypes.length === 0 ? (
        <div>You need to create some relation types first.</div>
      ) : (
        <>
          {discourseRelations.map((relation, index) => (
            <div key={index} className="setting-item">
              <div className="flex w-full flex-col">
                <div className="flex gap-2">
                  <select
                    value={relation.sourceId}
                    onChange={(e) =>
                      handleRelationChange(index, "sourceId", e.target.value)
                    }
                    className="flex-1 pl-2"
                  >
                    <option value="">Source Node Type</option>
                    {plugin.settings.nodeTypes.map((nodeType) => (
                      <option key={nodeType.id} value={nodeType.id}>
                        {nodeType.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={relation.relationshipTypeId}
                    onChange={(e) =>
                      handleRelationChange(
                        index,
                        "relationshipTypeId",
                        e.target.value,
                      )
                    }
                    className="flex-1 pl-2"
                  >
                    <option value="">Relation Type</option>
                    {plugin.settings.relationTypes.map((relType) => (
                      <option key={relType.id} value={relType.id}>
                        {relType.label} / {relType.complement}
                      </option>
                    ))}
                  </select>

                  <select
                    value={relation.destinationId}
                    onChange={(e) =>
                      handleRelationChange(
                        index,
                        "destinationId",
                        e.target.value,
                      )
                    }
                    className="flex-1 pl-2"
                  >
                    <option value="">Target Node Type</option>
                    {plugin.settings.nodeTypes.map((nodeType) => (
                      <option key={nodeType.id} value={nodeType.id}>
                        {nodeType.name}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => confirmDeleteRelation(index)}
                    className="mod-warning p-2"
                  >
                    Delete
                  </button>
                </div>

                {relation.sourceId &&
                  relation.relationshipTypeId &&
                  relation.destinationId && (
                    <div className="text-normal mt-2 p-2">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          {findNodeById(relation.sourceId)?.name ||
                            "Unknown Node"}
                        </div>

                        <div className="flex flex-1 flex-col items-center gap-2 px-4">
                          <div className="flex items-center">
                            <div className="text-accent-text text-sm">
                              {findRelationTypeById(relation.relationshipTypeId)
                                ?.label || "Unknown Relation"}
                            </div>
                            <div className="text-accent-text mx-1">→</div>
                          </div>
                          <div className="text-muted text-sm">
                            ←{" "}
                            <span className="text-accent-text">
                              {findRelationTypeById(relation.relationshipTypeId)
                                ?.complement || "Unknown Complement"}
                            </span>
                          </div>
                        </div>

                        <div className="flex-1 text-right">
                          {findNodeById(relation.destinationId)?.name ||
                            "Unknown Node"}
                        </div>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ))}
          <div className="setting-item">
            <div className="flex gap-2">
              <button onClick={handleAddRelation} className="p-2">
                Add Relation
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
        </>
      )}
    </div>
  );
};

export default RelationshipSettings;
