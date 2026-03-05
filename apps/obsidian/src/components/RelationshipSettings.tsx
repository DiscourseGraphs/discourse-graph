import { useState } from "react";
import { DiscourseRelation, DiscourseRelationType } from "~/types";
import { Notice } from "obsidian";
import { usePlugin } from "./PluginContext";
import { ConfirmationModal } from "./ConfirmationModal";
import {
  getNodeTypeById,
  getImportInfo,
  formatImportSource,
} from "~/utils/typeUtils";
import generateUid from "~/utils/generateUid";

const RelationshipSettings = () => {
  const plugin = usePlugin();
  const [discourseRelations, setDiscourseRelations] = useState<
    DiscourseRelation[]
  >(() => plugin.settings.discourseRelations ?? []);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const findRelationTypeById = (
    id: string,
  ): DiscourseRelationType | undefined => {
    return plugin.settings.relationTypes.find((relType) => relType.id === id);
  };

  type EditableFieldKey = keyof Omit<
    DiscourseRelation,
    "id" | "modified" | "created" | "importedFromRid"
  >;

  const handleRelationChange = async (
    index: number,
    field: EditableFieldKey,
    value: string,
  ): Promise<void> => {
    const updatedRelations = [...discourseRelations];

    const now = new Date().getTime();
    if (!updatedRelations[index]) {
      const newId = generateUid("rel3");
      updatedRelations[index] = {
        id: newId,
        sourceId: "",
        destinationId: "",
        relationshipTypeId: "",
        created: now,
        modified: now,
      };
    }

    updatedRelations[index][field] = value;
    updatedRelations[index].modified = now;
    setDiscourseRelations(updatedRelations);
    setHasUnsavedChanges(true);
  };

  const handleAddRelation = (): void => {
    const newId = generateUid("rel3");
    const now = new Date().getTime();
    const updatedRelations = [
      ...discourseRelations,
      {
        id: newId,
        sourceId: "",
        destinationId: "",
        relationshipTypeId: "",
        created: now,
        modified: now,
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
      const sourceNode = getNodeTypeById(plugin, relation.sourceId);
      const targetNode = getNodeTypeById(plugin, relation.destinationId);
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

  const localRelations = discourseRelations.filter(
    (relation) => !relation.importedFromRid,
  );
  const importedRelations = discourseRelations.filter(
    (relation) => relation.importedFromRid,
  );

  const renderRelationItem = (relation: DiscourseRelation, index: number) => {
    const importInfo = getImportInfo(relation.importedFromRid);
    const isImported = importInfo.isImported;

    return (
      <div key={index} className="setting-item">
        <div className="flex w-full flex-col gap-1">
          <div className="flex gap-2">
            <select
              value={relation.sourceId}
              onChange={(e) =>
                handleRelationChange(index, "sourceId", e.target.value)
              }
              className="flex-1 pl-2"
              disabled={isImported}
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
              disabled={isImported}
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
                handleRelationChange(index, "destinationId", e.target.value)
              }
              className="flex-1 pl-2"
              disabled={isImported}
            >
              <option value="">Target Node Type</option>
              {plugin.settings.nodeTypes.map((nodeType) => (
                <option key={nodeType.id} value={nodeType.id}>
                  {nodeType.name}
                </option>
              ))}
            </select>

            {!isImported && (
              <button
                onClick={() => confirmDeleteRelation(index)}
                className="mod-warning p-2"
              >
                Delete
              </button>
            )}
          </div>
          {isImported && (
            <div className="text-muted flex items-center gap-2 text-xs">
              {importInfo.spaceUri && (
                <span>
                  from{" "}
                  {formatImportSource(
                    importInfo.spaceUri,
                    plugin.settings.spaceNames,
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="discourse-relations">
      {plugin.settings.nodeTypes.length === 0 ? (
        <div>You need to create some node types first.</div>
      ) : plugin.settings.relationTypes.length === 0 ? (
        <div>You need to create some relation types first.</div>
      ) : (
        <>
          {localRelations.length > 0 && (
            <div>
              <h4 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
                Local
              </h4>
              {localRelations.map((relation) => {
                const index = discourseRelations.indexOf(relation);
                return renderRelationItem(relation, index);
              })}
            </div>
          )}

          {importedRelations.length > 0 && (
            <div className="border-modifier-border mt-6 border-t pt-4">
              <h4 className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
                Imported
              </h4>
              <div className="border-modifier-border rounded border bg-secondary p-2">
                {importedRelations.map((relation) => {
                  const index = discourseRelations.indexOf(relation);
                  return renderRelationItem(relation, index);
                })}
              </div>
            </div>
          )}

          <div className="setting-item mt-4">
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
