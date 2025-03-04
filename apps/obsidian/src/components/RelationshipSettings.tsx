import { useState, useEffect } from "react";
import type DiscourseGraphPlugin from "../index";
import {
  DiscourseRelation,
  DiscourseNode,
  DiscourseRelationType,
} from "../types";
import { useApp } from "./AppContext";
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
        source: { name: value, format: "markdown" },
        destination: { name: value, format: "markdown" },
        relationshipType: { id: value, label: "", complement: "" },
      };
    } else {
      updatedRelations[index] = {
        ...updatedRelations[index],
        [field]: value,
      };
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
                        }}
                      >
                        <div>Forward: {getRelationLabel(relation)}</div>
                        <div>Reverse: {getComplementLabel(relation)}</div>
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
