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

  const [selectedRelationType, setSelectedRelationType] = useState<string>("");
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
    if (!selectedRelationType || !activeNodeTypeId) {
      setCompatibleNodeTypes([]);
      return;
    }

    const relations = plugin.settings.discourseRelations.filter(
      (relation) =>
        relation.relationshipTypeId === selectedRelationType &&
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
  }, [selectedRelationType, activeNodeTypeId, plugin.settings]);

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
      !selectedRelationType &&
      availableRelationTypes[0]
    ) {
      setSelectedRelationType(availableRelationTypes[0].id);
    }
  }, [availableRelationTypes, selectedRelationType]);

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

        if (!selectedRelationType) {
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
    [activeFile, activeNodeTypeId, compatibleNodeTypes, selectedRelationType],
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
    if (!selectedRelationType || !selectedNode) return;

    const relationType = plugin.settings.relationTypes.find(
      (r) => r.id === selectedRelationType,
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
    selectedRelationType,
  ]);

  const resetState = () => {
    setIsAddingRelation(false);
    setSelectedRelationType("");
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
          onSelect={(option) => option && setSelectedRelationType(option.id)}
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
            selectedRelationType
              ? "Search nodes (type at least 2 characters)..."
              : "Select a relationship type first"
          }
          getItemText={(node) => node.basename}
          renderItem={renderNodeItem}
          disabled={!selectedRelationType}
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

type GroupedRelation = {
  relationTypeOptions: RelationTypeOption;
  linkedFiles: TFile[];
};

const CurrentRelationships = ({
  activeFile,
}: RelationshipSectionProps) => {
  const plugin = usePlugin();
  const [groupedRelationships, setGroupedRelationships] = useState<
    GroupedRelation[]
  >([]);

  useEffect(() => {
    loadCurrentRelationships();

    const onMetadataChange = (file: TFile) => {
      if (file && file.path === activeFile.path) {
        loadCurrentRelationships();
      }
    };

    plugin.app.metadataCache.on("changed", onMetadataChange);

    return () => {
      plugin.app.metadataCache.off(
        "changed",
        onMetadataChange as (...data: unknown[]) => unknown,
      );
    };
  }, [activeFile, plugin]);

  const loadCurrentRelationships = async () => {
    const fileCache = plugin.app.metadataCache.getFileCache(activeFile);
    if (!fileCache?.frontmatter) return;

    const tempRelationships = new Map<string, GroupedRelation>();
    const activeNodeTypeId = fileCache.frontmatter.nodeTypeId;

    if (!activeNodeTypeId) return;

    for (const relationType of plugin.settings.relationTypes) {
      const frontmatterLinks = fileCache.frontmatter[relationType.id];
      if (!frontmatterLinks) continue;

      const links = Array.isArray(frontmatterLinks)
        ? frontmatterLinks
        : [frontmatterLinks];

      const relation = plugin.settings.discourseRelations.find(
        (rel) =>
          (rel.sourceId === activeNodeTypeId ||
            rel.destinationId === activeNodeTypeId) &&
          rel.relationshipTypeId === relationType.id,
      );

      if (!relation) continue;

      const isSource = relation.sourceId === activeNodeTypeId;
      const relationLabel = isSource
        ? relationType.label
        : relationType.complement;

      const relationKey = `${relationType.id}-${isSource}`;

      if (!tempRelationships.has(relationKey)) {
        tempRelationships.set(relationKey, {
          relationTypeOptions: {
            id: relationType.id,
            label: relationLabel,
            isSource,
          },
          linkedFiles: [],
        });
      }

      for (const link of links) {
        const match = link.match(/\[\[(.*?)\]\]/);
        if (!match) continue;

        const linkedFileName = match[1];
        const linkedFile = plugin.app.metadataCache.getFirstLinkpathDest(
          linkedFileName,
          activeFile.path,
        );

        if (!linkedFile) continue;

        const group = tempRelationships.get(relationKey)!;
        if (!group.linkedFiles.some((file) => file.path === linkedFile.path)) {
          group.linkedFiles.push(linkedFile);
        }
      }
    }

    setGroupedRelationships(Array.from(tempRelationships.values()));
  };

  if (groupedRelationships.length === 0) return null;

  return (
    <div className="current-relationships" style={{ marginBottom: "1.5rem" }}>
      <h4 style={{ marginBottom: "0.5rem", fontSize: "1rem" }}>
        Current Relationships
      </h4>
      <ul
        style={{
          listStyle: "none",
          padding: 0,
          margin: 0,
          borderRadius: "4px",
          border: "1px solid var(--background-modifier-border)",
        }}
      >
        {groupedRelationships.map((group) => (
          <li
            key={`${group.relationTypeOptions.id}-${group.relationTypeOptions.isSource}`}
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid var(--background-modifier-border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <div style={{ marginRight: "8px" }}>
                {group.relationTypeOptions.isSource ? "→" : "←"}
              </div>
              <div style={{ fontWeight: "bold" }}>
                {group.relationTypeOptions.label}
              </div>
            </div>

            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                marginLeft: "24px",
              }}
            >
              {group.linkedFiles.map((file) => (
                <li
                  key={file.path}
                  style={{
                    marginTop: "4px",
                  }}
                >
                  <a
                    href="#"
                    className="internal-link"
                    onClick={(e) => {
                      e.preventDefault();
                      plugin.app.workspace.openLinkText(
                        file.path,
                        activeFile.path,
                      );
                    }}
                    style={{
                      color: "var(--text-accent)",
                    }}
                  >
                    {file.basename}
                  </a>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const RelationshipSection = ({
  activeFile,
}: RelationshipSectionProps) => {
  return (
    <div className="relationship-manager">
      <CurrentRelationships activeFile={activeFile} />
      <AddRelationship activeFile={activeFile} />
    </div>
  );
};
