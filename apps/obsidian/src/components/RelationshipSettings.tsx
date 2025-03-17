import { useState } from "react";
import {
  DiscourseRelation,
  DiscourseNode,
  DiscourseRelationType,
} from "~/types";
import { Notice } from "obsidian";
import { usePlugin } from "./PluginContext";

const RelationshipSettings = () => {
  const plugin = usePlugin();
  const [discourseRelations, setDiscourseRelations] = useState<
    DiscourseRelation[]
  >(() => plugin.settings.discourseRelations ?? []);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null,
  );

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
    console.log("updatedRelations", updatedRelations);
    setHasUnsavedChanges(true);
  };

  const confirmDeleteRelation = (index: number): void => {
    setPendingDeleteIndex(index);
  };

  const cancelDelete = (): void => {
    setPendingDeleteIndex(null);
  };

  const handleDeleteRelation = async (index: number): Promise<void> => {
    const updatedRelations = discourseRelations.filter((_, i) => i !== index);
    setDiscourseRelations(updatedRelations);
    plugin.settings.discourseRelations = updatedRelations;
    await plugin.saveSettings();
    setPendingDeleteIndex(null);
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
      <h3>Node Type Relations</h3>

      {plugin.settings.nodeTypes.length === 0 && (
        <div>You need to create some node types first.</div>
      )}

      {plugin.settings.nodeTypes.length > 0 &&
        plugin.settings.relationTypes.length > 0 && (
          <>
            {discourseRelations.map((relation, index) => (
              <div key={index} className="setting-item">
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                  }}
                >
                  <div style={{ display: "flex", gap: "10px" }}>
                    <select
                      value={relation.sourceId}
                      onChange={(e) =>
                        handleRelationChange(index, "sourceId", e.target.value)
                      }
                      style={{ flex: 1 }}
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
                      style={{ flex: 1 }}
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
                      style={{ flex: 1 }}
                    >
                      <option value="">Target Node Type</option>
                      {plugin.settings.nodeTypes.map((nodeType) => (
                        <option key={nodeType.id} value={nodeType.id}>
                          {nodeType.name}
                        </option>
                      ))}
                    </select>

                    {pendingDeleteIndex === index ? (
                      <>
                        <button
                          onClick={() => handleDeleteRelation(index)}
                          className="mod-warning"
                        >
                          Confirm
                        </button>
                        <button onClick={cancelDelete}>Cancel</button>
                      </>
                    ) : (
                      <button
                        onClick={() => confirmDeleteRelation(index)}
                        className="mod-warning"
                      >
                        Delete
                      </button>
                    )}
                  </div>

                  {relation.sourceId &&
                    relation.relationshipTypeId &&
                    relation.destinationId && (
                      <div
                        style={{
                          marginTop: "8px",
                          color: "var(--text-normal)",
                          border: "1px solid var(--background-modifier-border)",
                          borderRadius: "4px",
                          padding: "8px",
                          background: "var(--background-secondary)",
                        }}
                        className="relationship-visualization"
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div className="relationship-node">
                            {findNodeById(relation.sourceId)?.name ||
                              "Unknown Node"}
                          </div>

                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              padding: "0 12px",
                            }}
                          >
                            <div
                              style={{ display: "flex", alignItems: "center" }}
                            >
                              <div
                                style={{
                                  fontSize: "0.85em",
                                  color: "var(--text-accent)",
                                }}
                              >
                                {findRelationTypeById(
                                  relation.relationshipTypeId,
                                )?.label || "Unknown Relation"}
                              </div>
                              <div
                                style={{
                                  margin: "0 4px",
                                  color: "var(--text-accent)",
                                }}
                              >
                                →
                              </div>
                            </div>
                            <div
                              style={{
                                fontSize: "0.85em",
                                color: "var(--text-muted)",
                              }}
                            >
                              ←{" "}
                              <span style={{ color: "var(--text-accent)" }}>
                                {findRelationTypeById(
                                  relation.relationshipTypeId,
                                )?.complement || "Unknown Complement"}
                              </span>
                            </div>
                          </div>

                          <div className="relationship-node">
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
              <div style={{ display: "flex", gap: "10px" }}>
                <button onClick={handleAddRelation}>Add Relation</button>
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
          </>
        )}
    </div>
  );
};

export default RelationshipSettings;
