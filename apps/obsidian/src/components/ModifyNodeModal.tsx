import { App, Modal, Notice, TFile } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import {
  StrictMode,
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { DiscourseNode } from "~/types";
import type DiscourseGraphPlugin from "~/index";
import { QueryEngine } from "~/services/QueryEngine";

type ModifyNodeFormProps = {
  nodeTypes: DiscourseNode[];
  onSubmit: (params: {
    nodeType: DiscourseNode;
    title: string;
    initialFile?: TFile; // for edit mode
    selectedExistingNode?: TFile;
    /** DiscourseRelation.id; when set, relation is created with currentFile as the other end. */
    relationshipId?: string;
    relationshipTargetFile?: TFile;
  }) => Promise<void>;
  onCancel: () => void;
  initialTitle?: string;
  initialNodeType?: DiscourseNode;
  initialFile?: TFile; // for edit mode
  currentFile?: TFile; // the file where the node is being created from
  plugin: DiscourseGraphPlugin;
};

export const ModifyNodeForm = ({
  nodeTypes,
  onSubmit,
  onCancel,
  initialTitle = "",
  initialNodeType,
  initialFile,
  currentFile,
  plugin,
}: ModifyNodeFormProps) => {
  const isEditMode = !!initialFile;
  const [title, setTitle] = useState(initialFile?.basename || initialTitle);
  const [selectedNodeType, setSelectedNodeType] =
    useState<DiscourseNode | null>(initialNodeType || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedExistingNode, setSelectedExistingNode] =
    useState<TFile | null>(null);
  const [query, setQuery] = useState(initialFile?.basename || initialTitle);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<TFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRelationshipKey, setSelectedRelationshipKey] = useState<
    string | undefined
  >(undefined);
  const queryEngine = useRef(new QueryEngine(plugin.app));
  const titleInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  // Search for nodes when query changes (only in create mode)
  useEffect(() => {
    if (isEditMode) {
      setSearchResults([]);
      return;
    }
    const searchQuery = query.trim();
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    setIsSearching(true);
    debounceTimeoutRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          const results = selectedNodeType
            ? await queryEngine.current.searchDiscourseNodesByTitle(
                searchQuery,
                selectedNodeType.id,
              )
            : await queryEngine.current.searchDiscourseNodesByTitle(
                searchQuery,
              );
          setSearchResults(results);
        } catch (error) {
          console.error("Error searching nodes:", error);
          setSearchResults([]);
        } finally {
          setIsSearching(false);
        }
      })();
    }, 250);
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [query, selectedNodeType, isEditMode]);

  const isOpen = useMemo(() => {
    return (
      !selectedExistingNode &&
      isFocused &&
      searchResults.length > 0 &&
      query.trim().length >= 2
    );
  }, [selectedExistingNode, isFocused, searchResults.length, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [searchResults]);

  useEffect(() => {
    if (isOpen && titleInputRef.current && popoverRef.current) {
      const inputRect = titleInputRef.current.getBoundingClientRect();
      const popover = popoverRef.current;
      popover.style.position = "fixed";
      popover.style.top = `${inputRect.bottom + 4}px`;
      popover.style.left = `${inputRect.left}px`;
      popover.style.width = `${inputRect.width}px`;
    }
  }, [isOpen]);

  useEffect(() => {
    if (menuRef.current && isOpen && activeIndex >= 0) {
      const activeElement = menuRef.current.children[
        activeIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      }
    }
  }, [activeIndex, isOpen]);

  // Determine available relationships based on current file and selected node type
  const availableRelationships = useMemo(() => {
    if (!currentFile || !selectedNodeType || isEditMode) {
      return [];
    }

    const currentFileCache = plugin.app.metadataCache.getFileCache(currentFile);
    const currentNodeTypeId = currentFileCache?.frontmatter?.nodeTypeId as
      | string
      | undefined;

    if (!currentNodeTypeId) {
      return [];
    }

    // Find all relations that connect the current node type to the selected node type
    const relevantRelations = plugin.settings.discourseRelations.filter(
      (relation) =>
        (relation.sourceId === currentNodeTypeId &&
          relation.destinationId === selectedNodeType.id) ||
        (relation.sourceId === selectedNodeType.id &&
          relation.destinationId === currentNodeTypeId),
    );

    const relations = relevantRelations
      .map((relation) => {
        const relationType = plugin.settings.relationTypes.find(
          (rt) => rt.id === relation.relationshipTypeId,
        );
        if (!relationType) return null;

        const isCurrentFileSource = relation.sourceId === currentNodeTypeId;
        return {
          relationTypeId: relation.relationshipTypeId,
          label: isCurrentFileSource
            ? relationType.label
            : relationType.complement,
          isCurrentFileSource,
          uniqueKey: relation.id,
        };
      })
      .filter(Boolean) as Array<{
      relationTypeId: string;
      label: string;
      isCurrentFileSource: boolean;
      uniqueKey: string;
    }>;

    return [
      ...relations,
      {
        uniqueKey: "",
        label: "No relation",
        relationTypeId: "",
        isCurrentFileSource: false,
      },
    ];
  }, [currentFile, selectedNodeType, isEditMode, plugin]);

  // Default to first option when list appears or selection is no longer valid
  useEffect(() => {
    const first = availableRelationships[0];
    if (!first) return;
    const isValid =
      selectedRelationshipKey !== undefined &&
      availableRelationships.some(
        (r) => r.uniqueKey === selectedRelationshipKey,
      );
    if (isValid) return;
    setSelectedRelationshipKey(first.uniqueKey);
  }, [availableRelationships, selectedRelationshipKey]);

  const isFormValid = title.trim() && selectedNodeType;

  const handleSelect = useCallback((file: TFile) => {
    setSelectedExistingNode(file);
    setQuery(file.basename);
    setTitle(file.basename);
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedExistingNode(null);
    setQuery("");
    setTitle("");
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 50);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (selectedExistingNode) {
      // If locked, only handle Escape
      if (e.key === "Escape") {
        e.preventDefault();
        handleClearSelection();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < searchResults.length - 1 ? prev + 1 : prev,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (isOpen && searchResults[activeIndex]) {
        handleSelect(searchResults[activeIndex]);
      } else if (isFormValid && !isSubmitting) {
        void handleConfirm();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleNodeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const newSelectedType =
      nodeTypes.find((nt) => nt.id === selectedId) || null;
    setSelectedNodeType(newSelectedType);
    if (selectedExistingNode) {
      setSelectedExistingNode(null);
      setQuery("");
      setTitle("");
    }
    setSelectedRelationshipKey(undefined);
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
    setTitle(newQuery);
    if (selectedExistingNode) {
      setSelectedExistingNode(null);
    }
  };

  const handleConfirm = useCallback(async () => {
    if (!isFormValid || isSubmitting) {
      return;
    }

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      new Notice("Please enter a title", 3000);
      return;
    }

    if (!selectedNodeType) {
      new Notice("Please select a node type", 3000);
      return;
    }

    try {
      setIsSubmitting(true);
      const key =
        selectedRelationshipKey ?? availableRelationships[0]?.uniqueKey ?? "";
      const selectedRel = key
        ? availableRelationships.find((r) => r.uniqueKey === key)
        : undefined;
      await onSubmit({
        nodeType: selectedNodeType,
        title: trimmedTitle,
        initialFile,
        selectedExistingNode: selectedExistingNode || undefined,
        relationshipId: selectedRel?.uniqueKey || undefined,
        relationshipTargetFile: currentFile || undefined,
      });
      onCancel();
    } catch (error) {
      console.error(
        `Error ${isEditMode ? "modifying" : "creating"} node:`,
        error,
      );
      new Notice(
        `Error ${isEditMode ? "modifying" : "creating"} node: ${error instanceof Error ? error.message : String(error)}`,
        5000,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isFormValid,
    isSubmitting,
    onSubmit,
    onCancel,
    title,
    selectedNodeType,
    isEditMode,
    initialFile,
    selectedExistingNode,
    selectedRelationshipKey,
    currentFile,
    availableRelationships,
  ]);

  return (
    <div>
      <h2>{isEditMode ? "Modify discourse node" : "Create discourse node"}</h2>
      <div className="setting-item">
        <div className="setting-item-name">Type</div>
        <div className="setting-item-control">
          <select
            value={selectedNodeType?.id || ""}
            onChange={handleNodeTypeChange}
            disabled={isSubmitting || isEditMode}
            className="w-full"
          >
            <option value="">Select node type</option>
            {nodeTypes.map((nodeType) => (
              <option key={nodeType.id} value={nodeType.id}>
                {nodeType.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="setting-item">
        <div className="setting-item-name">Content</div>
        <div className="setting-item-control">
          {selectedExistingNode ? (
            // Locked state: show selected node with clear button
            <div className="relative flex w-full items-start">
              <input
                type="text"
                value={selectedExistingNode.basename}
                readOnly
                disabled={isSubmitting}
                className="resize-vertical font-inherit border-background-modifier-border bg-background-secondary text-text-normal max-h-[6em] min-h-[2.5em] w-full cursor-default overflow-y-auto rounded-md border p-2 pr-8"
              />
              <button
                onClick={handleClearSelection}
                className="text-muted hover:text-normal absolute right-2 top-2 flex h-4 w-4 cursor-pointer items-center justify-center rounded border-0 bg-transparent text-xs"
                aria-label="Clear selection"
                type="button"
                disabled={isSubmitting}
              >
                ✕
              </button>
            </div>
          ) : (
            // Search input with popover (only in create mode)
            <div className="relative w-full">
              <input
                ref={titleInputRef}
                type="text"
                placeholder={
                  isEditMode
                    ? "Enter new content"
                    : selectedNodeType
                      ? `Search for existing ${selectedNodeType.name.toLowerCase()} or enter new content`
                      : "Search for existing nodes or enter new content"
                }
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (!isEditMode) {
                    setIsFocused(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setIsFocused(false), 200);
                }}
                disabled={isSubmitting}
                className="resize-vertical font-inherit border-background-modifier-border bg-background-primary text-text-normal max-h-[6em] min-h-[2.5em] w-full overflow-y-auto rounded-md border p-2"
                autoComplete="off"
              />
              {isOpen && !isEditMode && (
                <div
                  ref={popoverRef}
                  className="suggestion-container fixed z-[1000] mt-1 max-h-[256px] overflow-y-auto rounded-[var(--radius-s)] border border-[var(--background-modifier-border)] bg-[var(--background-primary)] shadow-[var(--shadow-s)]"
                >
                  <ul
                    ref={menuRef}
                    className="suggestion-list m-0 list-none py-1"
                  >
                    {isSearching ? (
                      <li className="suggestion-item px-3 py-2 text-[var(--text-muted)]">
                        Searching...
                      </li>
                    ) : searchResults.length === 0 ? (
                      <li className="suggestion-item px-3 py-2 text-[var(--text-muted)]">
                        No results found
                      </li>
                    ) : (
                      searchResults.map((file, index) => (
                        <li
                          key={file.path}
                          className={`suggestion-item flex cursor-pointer items-center gap-2 px-3 py-2 ${
                            index === activeIndex
                              ? "is-selected bg-[var(--background-modifier-hover)]"
                              : "bg-transparent"
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelect(file);
                          }}
                          onMouseEnter={() => setActiveIndex(index)}
                        >
                          <span>{file.basename}</span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {availableRelationships.length > 0 && !isEditMode && currentFile && (
        <div className="setting-item">
          <div className="setting-item-name">
            Relationship with &quot;{currentFile.basename}&quot;
          </div>
          <div className="setting-item-control">
            <select
              value={
                selectedRelationshipKey ??
                availableRelationships[0]?.uniqueKey ??
                ""
              }
              onChange={(e) => setSelectedRelationshipKey(e.target.value)}
              disabled={isSubmitting}
              className="w-full"
            >
              {availableRelationships.map((rel) => (
                <option key={rel.uniqueKey || "none"} value={rel.uniqueKey}>
                  {rel.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="modal-button-container mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="mod-normal"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button
          type="button"
          className="mod-cta"
          onClick={() => {
            void handleConfirm();
          }}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting
            ? isEditMode
              ? "Modifying..."
              : "Creating..."
            : "Confirm"}
        </button>
      </div>
    </div>
  );
};

type ModifyNodeModalProps = {
  nodeTypes: DiscourseNode[];
  plugin: DiscourseGraphPlugin;
  onSubmit: (params: {
    nodeType: DiscourseNode;
    title: string;
    initialFile?: TFile;
    selectedExistingNode?: TFile;
    relationshipId?: string;
    relationshipTargetFile?: TFile;
  }) => Promise<void>;
  initialTitle?: string;
  initialNodeType?: DiscourseNode;
  initialFile?: TFile;
  currentFile?: TFile;
};

class ModifyNodeModal extends Modal {
  private nodeTypes: DiscourseNode[];
  private onSubmit: (params: {
    nodeType: DiscourseNode;
    title: string;
    initialFile?: TFile;
    selectedExistingNode?: TFile;
    relationshipId?: string;
    relationshipTargetFile?: TFile;
  }) => Promise<void>;
  private root: Root | null = null;
  private initialTitle?: string;
  private initialNodeType?: DiscourseNode;
  private initialFile?: TFile;
  private currentFile?: TFile;
  private plugin: DiscourseGraphPlugin;

  constructor(app: App, props: ModifyNodeModalProps) {
    super(app);
    this.nodeTypes = props.nodeTypes;
    this.onSubmit = props.onSubmit;
    this.initialTitle = props.initialTitle;
    this.initialNodeType = props.initialNodeType;
    this.initialFile = props.initialFile;
    this.currentFile = props.currentFile;
    this.plugin = props.plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.root = createRoot(contentEl);
    this.root.render(
      <StrictMode>
        <ModifyNodeForm
          nodeTypes={this.nodeTypes}
          onSubmit={this.onSubmit}
          onCancel={() => this.close()}
          initialTitle={this.initialTitle}
          initialNodeType={this.initialNodeType}
          initialFile={this.initialFile}
          currentFile={this.currentFile}
          plugin={this.plugin}
        />
      </StrictMode>,
    );
  }

  onClose() {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
    const { contentEl } = this;
    contentEl.empty();
  }
}
export default ModifyNodeModal;
