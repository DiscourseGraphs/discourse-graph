import { TFile, Notice } from "obsidian";
import { useState } from "react";
import DiscourseGraphPlugin from "~/index";
import { QueryEngine } from "~/services/QueryEngine";
import { SearchBar } from "~/components/SearchBar";

type RelationTypeOption = {
  id: string;
  label: string;
  isSource: boolean;
};

type RelationshipSectionProps = {
  plugin: DiscourseGraphPlugin;
  activeFile: TFile;
};

export const RelationshipSection = ({
  plugin,
  activeFile,
}: RelationshipSectionProps) => {
  const [selectedRelationType, setSelectedRelationType] = useState<string>("");
  const [selectedNode, setSelectedNode] = useState<TFile | null>(null);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const queryEngine = new QueryEngine(plugin.app);

  const activeNodeTypeId = (() => {
    const fileCache = plugin.app.metadataCache.getFileCache(activeFile);
    return fileCache?.frontmatter?.nodeTypeId;
  })();

  const getAvailableRelationTypes = () => {
    if (!activeNodeTypeId) return [];

    const options: RelationTypeOption[] = [];

    const relevantRelations = plugin.settings.discourseRelations.filter(
      (relation) =>
        relation.sourceId === activeNodeTypeId ||
        relation.destinationId === activeNodeTypeId,
    );

    relevantRelations.forEach((relation) => {
      const relationType = plugin.settings.relationTypes.find(
        (type) => type.id === relation.relationshipTypeId,
      );

      if (!relationType) return;

      const isSource = relation.sourceId === activeNodeTypeId;

      const existingOption = options.find(
        (opt) => opt.id === relationType.id && opt.isSource === isSource,
      );

      if (!existingOption) {
        options.push({
          id: relationType.id,
          label: isSource ? relationType.label : relationType.complement,
          isSource,
        });
      }
    });

    return options;
  };

  const availableRelationTypes = getAvailableRelationTypes();

  const searchNodes = async (query: string): Promise<TFile[]> => {
    return queryEngine.searchNodeByTitle(query, {
      excludeFile: activeFile,
    });
  };

  const addRelationship = async () => {
    if (!selectedRelationType || !selectedNode) return;

    const relationType = plugin.settings.relationTypes.find(
      (r) => r.id === selectedRelationType,
    );
    if (!relationType) return;

    try {
      const activeFileContent = await plugin.app.vault.read(activeFile);
      const selectedNodeContent = await plugin.app.vault.read(selectedNode);

      const appendLinkToFrontmatter = async (file: TFile, link: string) => {
        await plugin.app.fileManager.processFrontMatter(file, (fm) => {
          const existingLinks = Array.isArray(fm[relationType.id])
            ? fm[relationType.id]
            : [];
          fm[relationType.id] = [...existingLinks, link];
        });
      };

      try {
        await appendLinkToFrontmatter(activeFile, `[[${selectedNode.name}]]`);
        await appendLinkToFrontmatter(selectedNode, `[[${activeFile.name}]]`);
      } catch (innerError) {
        // Rollback changes if necessary
        await plugin.app.vault.modify(activeFile, activeFileContent);
        await plugin.app.vault.modify(selectedNode, selectedNodeContent);
        throw innerError;
      }

      new Notice(
        `Successfully added ${relationType.label} with ${selectedNode.name}`,
      );

      resetState();
    } catch (error) {
      console.error("Failed to add relationship:", error);
      new Notice(
        `Failed to add relationship: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const resetState = () => {
    setIsAddingRelation(false);
    setSelectedRelationType("");
    setSelectedNode(null);
  };

  if (!isAddingRelation) {
    return (
      <button
        className="add-relation-button"
        style={{
          width: "100%",
          padding: "8px 12px",
          backgroundColor: "var(--interactive-accent)",
          color: "var(--text-on-accent)",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          marginTop: "1rem",
        }}
        onClick={() => setIsAddingRelation(true)}
      >
        Add a new relation
      </button>
    );
  }

  return (
    <div className="relationship-manager">
      <div
        className="relationship-type-selector"
        style={{ marginBottom: "1rem" }}
      >
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Relationship Type:
        </label>
        <SearchBar<RelationTypeOption>
          app={plugin.app}
          onNodeSelect={(option) =>
            option && setSelectedRelationType(option.id)
          }
          placeholder="Search available relationship types..."
          getItemText={(option) => option.label}
          getItemKey={(option) => `${option.id}-${option.isSource}`}
          options={availableRelationTypes}
          renderItemContent={(option) => (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ marginRight: "8px" }}>
                {option.isSource ? "➡️" : "⬅️"}
              </div>
              <div>{option.label}</div>
            </div>
          )}
        />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Node to link with:
        </label>
        <SearchBar<TFile>
          app={plugin.app}
          searchFunction={searchNodes}
          onNodeSelect={setSelectedNode}
          placeholder="Search nodes (type at least 2 characters)..."
          getItemText={(node) => node.name}
          getItemKey={(node) => node.path}
          renderItemContent={(node) => (
            <div style={{ display: "flex", alignItems: "center" }}>
              <div style={{ marginRight: "8px" }}>📄</div>
              <div>{node.name}</div>
            </div>
          )}
        />
      </div>

      <div className="buttons" style={{ display: "flex", gap: "8px" }}>
        <button
          disabled={!selectedNode || !selectedRelationType}
          style={{
            flex: 1,
            padding: "8px 12px",
            backgroundColor:
              selectedNode && selectedRelationType
                ? "var(--interactive-accent)"
                : "var(--background-modifier-border)",
            color:
              selectedNode && selectedRelationType
                ? "var(--text-on-accent)"
                : "var(--text-normal)",
            border: "none",
            borderRadius: "4px",
            cursor:
              selectedNode && selectedRelationType ? "pointer" : "not-allowed",
          }}
          onClick={addRelationship}
        >
          Confirm
        </button>

        <button
          style={{
            padding: "8px 12px",
            backgroundColor: "var(--background-modifier-border)",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          onClick={resetState}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
