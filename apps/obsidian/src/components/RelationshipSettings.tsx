import { useState, useEffect } from "react";
import type DiscourseGraphPlugin from "../index";
import {
  DiscourseRelation,
  DiscourseNode,
  DiscourseRelationType,
} from "../types";
import { Notice } from "obsidian";

const RelationshipSettings = ({ plugin }: { plugin: DiscourseGraphPlugin }) => {
  const [discourseRelations, setDiscourseRelations] = useState<
    DiscourseRelation[]
  >(() => plugin.settings.discourseRelations ?? []);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    const initializeSettings = async () => {
      let needsSave = false;

      if (!plugin.settings.discourseRelations) {
        plugin.settings.discourseRelations = [];
        needsSave = true;
      }

      if (needsSave) {
        await plugin.saveSettings();
      }
    };

    initializeSettings();
  }, [plugin]);

  const handleRelationChange = async (
    index: number,
    field: keyof DiscourseRelation,
    value: string,
  ): Promise<void> => {
    const updatedRelations = [...discourseRelations];
    if (!updatedRelations[index]) {
      updatedRelations[index] = {
        source: { name: "", format: "markdown" },
        destination: { name: "", format: "markdown" },
        relationshipType: { id: "", label: "", complement: "" },
      };
    }

    // Handle each field type appropriately
    if (field === "source" || field === "destination") {
      // For source and destination, update the node's name
      // Find the matching node type to get its format
      const nodeType = plugin.settings.nodeTypes.find(
        (nt) => nt.name === value,
      );
      updatedRelations[index][field] = {
        name: value,
        format: nodeType?.format || "markdown",
      };
    } else if (field === "relationshipType") {
      // For relationshipType, we get an ID and need to find the complete relation type
      const relationType = plugin.settings.relationTypes.find(
        (rt) => rt.id === value,
      );
      if (relationType) {
        updatedRelations[index].relationshipType = {
          id: relationType.id,
          label: relationType.label,
          complement: relationType.complement,
        };
      } else {
        // If not found, just update the ID
        updatedRelations[index].relationshipType = {
          id: value,
          label: "",
          complement: "",
        };
      }
    }

    setDiscourseRelations(updatedRelations);
    setHasUnsavedChanges(true);
  };

  const handleAddRelation = (): void => {
    const updatedRelations = [
      ...discourseRelations,
      {
        source: { name: "", format: "markdown" },
        destination: { name: "", format: "markdown" },
        relationshipType: { id: "", label: "", complement: "" },
      },
    ];
    setDiscourseRelations(updatedRelations);
    setHasUnsavedChanges(true);
  };

  const handleDeleteRelation = async (index: number): Promise<void> => {
    const updatedRelations = discourseRelations.filter((_, i) => i !== index);
    setDiscourseRelations(updatedRelations);
    plugin.settings.discourseRelations = updatedRelations;
    await plugin.saveSettings();
    await plugin.loadSettings();
  };

  const getRelationLabel = (relation: DiscourseRelation): string => {
    const relationType = plugin.settings.relationTypes.find(
      (rt) => rt.id === relation.relationshipType.id,
    );

    if (!relationType) return "Invalid relation";

    const sourceType = plugin.settings.nodeTypes.find(
      (nt) => nt.name === relation.source.name,
    );

    const targetType = plugin.settings.nodeTypes.find(
      (nt) => nt.name === relation.destination.name,
    );

    if (!sourceType || !targetType) return "Invalid node types";

    return `${sourceType.name} ${relationType.label} ${targetType.name}`;
  };

  const getComplementLabel = (relation: DiscourseRelation): string => {
    const relationType = plugin.settings.relationTypes.find(
      (rt) => rt.id === relation.relationshipType.id,
    );

    if (!relationType) return "Invalid relation";

    const sourceType = plugin.settings.nodeTypes.find(
      (nt) => nt.name === relation.source.name,
    );

    const targetType = plugin.settings.nodeTypes.find(
      (nt) => nt.name === relation.destination.name,
    );

    if (!sourceType || !targetType) return "Invalid node types";

    return `${targetType.name} ${relationType.complement} ${sourceType.name}`;
  };

  const handleSave = async (): Promise<void> => {
    // Validate relations
    for (const relation of discourseRelations) {
      if (
        !relation.relationshipType.id ||
        !relation.source.name ||
        !relation.destination.name
      ) {
        new Notice("All fields are required for relations.");
        return;
      }
    }

    // Check for duplicate relations
    const relationKeys = discourseRelations.map(
      (r) => `${r.relationshipType.id}-${r.source.name}-${r.destination.name}`,
    );
    if (new Set(relationKeys).size !== relationKeys.length) {
      new Notice("Duplicate relations are not allowed.");
      return;
    }

    plugin.settings.discourseRelations = discourseRelations;
    await plugin.saveSettings();
    await plugin.loadSettings();
    setHasUnsavedChanges(false);
  };

  return (
    <div className="discourse-relations">
      <h3>Node Type Relations</h3>

      {plugin.settings.nodeTypes.length === 0 && (
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-description">
              You need to create some node types first.
            </div>
          </div>
        </div>
      )}

      {plugin.settings.relationTypes.length === 0 && (
        <div className="setting-item">
          <div className="setting-item-info">
            <div className="setting-item-description">
              You need to create some relation types first.
            </div>
          </div>
        </div>
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
                      value={relation.source.name}
                      onChange={(e) =>
                        handleRelationChange(index, "source", e.target.value)
                      }
                      style={{ flex: 1 }}
                    >
                      <option value="">Source Node Type</option>
                      {plugin.settings.nodeTypes.map((nodeType) => (
                        <option key={nodeType.name} value={nodeType.name}>
                          {nodeType.name}
                        </option>
                      ))}
                    </select>

                    <select
                      value={relation.relationshipType.id}
                      onChange={(e) =>
                        handleRelationChange(
                          index,
                          "relationshipType",
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
                      value={relation.destination.name}
                      onChange={(e) =>
                        handleRelationChange(
                          index,
                          "destination",
                          e.target.value,
                        )
                      }
                      style={{ flex: 1 }}
                    >
                      <option value="">Target Node Type</option>
                      {plugin.settings.nodeTypes.map((nodeType) => (
                        <option key={nodeType.name} value={nodeType.name}>
                          {nodeType.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleDeleteRelation(index)}
                      className="mod-warning"
                    >
                      Delete
                    </button>
                  </div>

                  {relation.source.name &&
                    relation.relationshipType.id &&
                    relation.destination.name && (
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
                            {relation.source.name}
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
                                {relation.relationshipType.label}
                              </div>
                              <div
                                style={{
                                  margin: "0 4px",
                                  fontSize: "1.2em",
                                  color: "var(--text-accent)",
                                }}
                              >
                                →
                              </div>
                            </div>
                            <div
                              style={{
                                width: "100%",
                                textAlign: "center",
                                borderTop:
                                  "1px solid var(--background-modifier-border)",
                                margin: "4px 0",
                              }}
                            ></div>
                            <div
                              style={{ display: "flex", alignItems: "center" }}
                            >
                              <div
                                style={{
                                  margin: "0 4px",
                                  fontSize: "1.2em",
                                  color: "var(--text-accent)",
                                }}
                              >
                                ←
                              </div>
                              <div
                                style={{
                                  fontSize: "0.85em",
                                  color: "var(--text-accent)",
                                }}
                              >
                                {relation.relationshipType.complement}
                              </div>
                            </div>
                          </div>

                          <div className="relationship-node">
                            {relation.destination.name}
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
