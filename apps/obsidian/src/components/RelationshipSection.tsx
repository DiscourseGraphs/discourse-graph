import { TFile, Notice } from "obsidian";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { QueryEngine } from "~/services/QueryEngine";
import SearchBar from "./SearchBar";
import { DiscourseNode } from "~/types";
import DropdownSelect from "./DropdownSelect";
import { usePlugin } from "./PluginContext";

type RelationTypeOption = {
  id: string;
  label: string;
  isSource: boolean;
};

type RelationshipSectionProps = {
  activeFile: TFile;
};

const AddRelationship = ({ activeFile }: RelationshipSectionProps) => {
  const plugin = usePlugin();

  const [selectedRelationTypeId, setSelectedRelationTypeId] =
    useState<string>("");
  const [selectedNode, setSelectedNode] = useState<TFile | null>(null);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [compatibleNodeTypes, setCompatibleNodeTypes] = useState<
    DiscourseNode[]
  >([]);

  const queryEngineRef = useRef<QueryEngine | null>(null);

  const activeNodeTypeId = (() => {
    const fileCache = plugin.app.metadataCache.getFileCache(activeFile);
    return fileCache?.frontmatter?.nodeTypeId;
  })();

  useEffect(() => {
    if (!queryEngineRef.current) {
      queryEngineRef.current = new QueryEngine(plugin.app);
    }
  }, [plugin.app]);

  useEffect(() => {
    if (!selectedRelationTypeId || !activeNodeTypeId) {
      setCompatibleNodeTypes([]);
      return;
    }

    const relations = plugin.settings.discourseRelations.filter(
      (relation) =>
        relation.relationshipTypeId === selectedRelationTypeId &&
        (relation.sourceId === activeNodeTypeId ||
          relation.destinationId === activeNodeTypeId),
    );

    const compatibleNodeTypeIds = relations.map((relation) =>
      relation.sourceId === activeNodeTypeId
        ? relation.destinationId
        : relation.sourceId,
    );

    const compatibleNodeTypes = compatibleNodeTypeIds
      .map((id) => {
        const nodeType = plugin.settings.nodeTypes.find(
          (type) => type.id === id,
        );
        return nodeType;
      })
      .filter(Boolean) as DiscourseNode[];

    setCompatibleNodeTypes(compatibleNodeTypes);
  }, [selectedRelationTypeId, activeNodeTypeId, plugin.settings]);

  const getAvailableRelationTypes = useCallback(() => {
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
  }, [activeNodeTypeId, plugin.settings]);

  const availableRelationTypes = useMemo(
    () => getAvailableRelationTypes(),
    [getAvailableRelationTypes],
  );

  // Auto-select the relation type if there's only one option
  useEffect(() => {
    if (
      availableRelationTypes.length === 1 &&
      !selectedRelationTypeId &&
      availableRelationTypes[0]
    ) {
      setSelectedRelationTypeId(availableRelationTypes[0].id);
    }
  }, [availableRelationTypes, selectedRelationTypeId]);

  const searchNodes = useCallback(
    async (query: string): Promise<TFile[]> => {
      if (!queryEngineRef.current) {
        setSearchError("Search engine not initialized");
        return [];
      }

      setSearchError(null);
      try {
        if (!activeNodeTypeId) {
          setSearchError("Active file does not have a node type");
          return [];
        }

        if (!selectedRelationTypeId) {
          setSearchError("Please select a relationship type first");
          return [];
        }

        if (compatibleNodeTypes.length === 0) {
          setSearchError(
            "No compatible node types available for the selected relation type",
          );
          return [];
        }

        const nodeTypeIdsToSearch = compatibleNodeTypes.map((type) => type.id);

        const results =
          await queryEngineRef.current?.searchCompatibleNodeByTitle(
            query,
            nodeTypeIdsToSearch,
            activeFile,
            selectedRelationTypeId,
          );

        if (results.length === 0 && query.length >= 2) {
          setSearchError(
            "No matching nodes found. Try a different search term.",
          );
        }

        return results;
      } catch (error) {
        setSearchError(
          error instanceof Error ? error.message : "Unknown search error",
        );
        return [];
      }
    },
    [activeFile, activeNodeTypeId, compatibleNodeTypes, selectedRelationTypeId],
  );

  const renderNodeItem = (file: TFile, el: HTMLElement) => {
    const suggestionEl = el.createEl("div", {
      cls: "file-suggestion",
      attr: { style: "display: flex; align-items: center;" },
    });

    suggestionEl.createEl("div", {
      text: "📄",
      attr: { style: "margin-right: 8px;" },
    });

    suggestionEl.createEl("div", { text: file.basename });
  };

  const addRelationship = useCallback(async () => {
    if (!selectedRelationTypeId || !selectedNode) return;

    const relationType = plugin.settings.relationTypes.find(
      (r) => r.id === selectedRelationTypeId,
    );
    if (!relationType) return;

    try {
      const appendLinkToFrontmatter = async (file: TFile, link: string) => {
        await plugin.app.fileManager.processFrontMatter(file, (fm) => {
          const existingLinks = Array.isArray(fm[relationType.id])
            ? fm[relationType.id]
            : [];
          fm[relationType.id] = [...existingLinks, link];
        });
      };

      await appendLinkToFrontmatter(
        activeFile,
        `"[[${selectedNode.name}]]"`.replace(/^['"]+|['"]+$/g, ""),
      );
      await appendLinkToFrontmatter(
        selectedNode,
        `"[[${activeFile.name}]]"`.replace(/^['"]+|['"]+$/g, ""),
      );

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
  }, [
    activeFile,
    plugin.app.fileManager,
    plugin.settings.relationTypes,
    selectedNode,
    selectedRelationTypeId,
  ]);

  const resetState = () => {
    setIsAddingRelation(false);
    setSelectedRelationTypeId("");
    setSelectedNode(null);
    setSearchError(null);
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
        <DropdownSelect<RelationTypeOption>
          options={availableRelationTypes}
          onSelect={(option) => option && setSelectedRelationTypeId(option.id)}
          placeholder="Select relation type"
          getItemText={(option) => option.label}
        />
      </div>

      {compatibleNodeTypes.length > 0 && (
        <div style={{ marginBottom: "0.75rem" }}>
          <div
            style={{
              fontSize: "0.85rem",
              color: "var(--text-muted)",
              background: "var(--background-secondary)",
              padding: "0.5rem",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ marginRight: "0.5rem" }}>💡</span>
            <span>
              You can link with:{" "}
              {compatibleNodeTypes.map((type) => (
                <span
                  key={type.id}
                  style={{
                    background: "var(--background-modifier-border)",
                    padding: "0.15rem 0.4rem",
                    borderRadius: "4px",
                    marginRight: "0.25rem",
                    fontSize: "0.8rem",
                    display: "inline-block",
                  }}
                >
                  {type.name}
                </span>
              ))}
            </span>
          </div>
        </div>
      )}

      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", marginBottom: "0.5rem" }}>
          Node to link with:
        </label>
        <SearchBar<TFile>
          asyncSearch={searchNodes}
          onSelect={setSelectedNode}
          placeholder={
            selectedRelationTypeId
              ? "Search nodes (type at least 2 characters)..."
              : "Select a relationship type first"
          }
          getItemText={(node) => node.basename}
          renderItem={renderNodeItem}
          disabled={!selectedRelationTypeId}
        />
        {searchError && (
          <div
            style={{
              color: "var(--text-error)",
              fontSize: "12px",
              marginTop: "4px",
            }}
          >
            Search error: {searchError}
          </div>
        )}
      </div>

      <div className="buttons" style={{ display: "flex", gap: "8px" }}>
        <button
          disabled={!selectedNode || !selectedRelationTypeId}
          style={{
            flex: 1,
            padding: "8px 12px",
            backgroundColor:
              selectedNode && selectedRelationTypeId
                ? "var(--interactive-accent)"
                : "var(--background-modifier-border)",
            color:
              selectedNode && selectedRelationTypeId
                ? "var(--text-on-accent)"
                : "var(--text-normal)",
            border: "none",
            borderRadius: "4px",
            cursor:
              selectedNode && selectedRelationTypeId
                ? "pointer"
                : "not-allowed",
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

export const RelationshipSection = ({
  activeFile,
}: RelationshipSectionProps) => {
  return (
    <div className="relationship-manager">
      <AddRelationship activeFile={activeFile} />
    </div>
  );
};
