import { useState } from "react";
import { DiscourseRelation, DiscourseRelationType } from "~/types";
import { Notice } from "obsidian";
import { usePlugin } from "./PluginContext";
import { ConfirmationModal } from "./ConfirmationModal";
import {
  getNodeTypeById,
  getImportInfo,
  formatImportSource,
  isAcceptedSchema,
  isProvisionalSchema,
} from "~/utils/typeUtils";
import generateUid from "~/utils/generateUid";

const RelationshipSettings = () => {
  const plugin = usePlugin();
  const [discourseRelations, setDiscourseRelations] = useState<
    DiscourseRelation[]
  >(() => plugin.settings.discourseRelations ?? []);
  const [errors, setErrors] = useState<Record<number, string>>({});

  const findRelationTypeById = (
    id: string,
  ): DiscourseRelationType | undefined => {
    return plugin.settings.relationTypes.find((relType) => relType.id === id);
  };

  type EditableFieldKey = keyof Omit<
    DiscourseRelation,
    "id" | "modified" | "created" | "importedFromRid" | "status"
  >;

  const saveSettings = (relations: DiscourseRelation[]): void => {
    const newErrors: Record<number, string> = {};
    const completeRelations = relations.filter(
      (r) => r.relationshipTypeId && r.sourceId && r.destinationId,
    );

    // Check for duplicates among complete relations
    const seenKeys = new Map<string, number>();
    for (const r of completeRelations) {
      const idx = relations.indexOf(r);
      const key = `${r.relationshipTypeId}-${r.sourceId}-${r.destinationId}`;
      const prev = seenKeys.get(key);
      if (prev !== undefined) {
        newErrors[idx] = "Duplicate relation";
        if (!newErrors[prev]) newErrors[prev] = "Duplicate relation";
      }
      seenKeys.set(key, idx);
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    // Persist complete local relations + all imported relations
    const importedRelations = relations.filter((r) => r.importedFromRid);
    plugin.settings.discourseRelations = [
      ...completeRelations.filter((r) => !r.importedFromRid),
      ...importedRelations,
    ];
    void plugin.saveSettings();
  };

  const handleRelationChange = (
    index: number,
    field: EditableFieldKey,
    value: string,
  ): void => {
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

    updatedRelations[index] = {
      ...updatedRelations[index],
      [field]: value,
      modified: now,
    };
    setDiscourseRelations(updatedRelations);
    saveSettings(updatedRelations);
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

  const handleAcceptRelation = async (index: number): Promise<void> => {
    const updatedRelations = [...discourseRelations];
    const relation = updatedRelations[index];
    if (!relation) return;
    updatedRelations[index] = { ...relation, status: "accepted" };

    // Cascade: also accept the relation type if it is still provisional
    const updatedRelationTypes = [...plugin.settings.relationTypes];
    const relTypeIndex = updatedRelationTypes.findIndex(
      (rt) => rt.id === relation.relationshipTypeId,
    );
    if (
      relTypeIndex >= 0 &&
      isProvisionalSchema(updatedRelationTypes[relTypeIndex]!)
    ) {
      updatedRelationTypes[relTypeIndex] = {
        ...updatedRelationTypes[relTypeIndex]!,
        status: "accepted",
      };
      plugin.settings.relationTypes = updatedRelationTypes;
    }

    setDiscourseRelations(updatedRelations);
    plugin.settings.discourseRelations = updatedRelations;
    await plugin.saveSettings();
  };

  const handleDeleteRelation = async (index: number): Promise<void> => {
    const updatedRelations = discourseRelations.filter((_, i) => i !== index);
    setDiscourseRelations(updatedRelations);
    plugin.settings.discourseRelations = updatedRelations;
    await plugin.saveSettings();
    new Notice("Relation deleted");
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
    const isProvisional = isProvisionalSchema(relation);
    const spaceName = importInfo.spaceUri
      ? formatImportSource(importInfo.spaceUri, plugin.settings.spaceNames)
      : "imported space";
    const error = errors[index];

    return (
      <div key={index} className="setting-item">
        <div className="flex w-full flex-col gap-1">
          <div className="flex gap-2">
            <select
              value={relation.sourceId}
              onChange={(e) =>
                handleRelationChange(index, "sourceId", e.target.value)
              }
              className={`flex-1 pl-2 ${error ? "input-error" : ""}`}
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
              className={`flex-1 pl-2 ${error ? "input-error" : ""}`}
              disabled={isImported}
            >
              <option value="">Relation Type</option>
              {(isImported
                ? plugin.settings.relationTypes
                : plugin.settings.relationTypes.filter(isAcceptedSchema)
              ).map((relType) => (
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
              className={`flex-1 pl-2 ${error ? "input-error" : ""}`}
              disabled={isImported}
            >
              <option value="">Target Node Type</option>
              {plugin.settings.nodeTypes.map((nodeType) => (
                <option key={nodeType.id} value={nodeType.id}>
                  {nodeType.name}
                </option>
              ))}
            </select>

            {isImported ? (
              <div className="flex gap-2">
                {isProvisional && (
                  <button
                    onClick={() => void handleAcceptRelation(index)}
                    className="p-2"
                    title={`Accept this relation triplet from ${spaceName} to create instances of this relation`}
                  >
                    Accept
                  </button>
                )}
                <button
                  onClick={() => confirmDeleteRelation(index)}
                  className="mod-warning p-2"
                >
                  Delete
                </button>
              </div>
            ) : (
              <button
                onClick={() => confirmDeleteRelation(index)}
                className="mod-warning p-2"
              >
                Delete
              </button>
            )}
          </div>
          {error && <div className="text-error text-xs">{error}</div>}
          {isImported && (
            <div className="text-muted flex items-center gap-2 text-xs">
              {isProvisional && (
                <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs font-medium text-yellow-800">
                  Provisional
                </span>
              )}
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
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default RelationshipSettings;
