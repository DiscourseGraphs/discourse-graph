import { App, Modal, Notice, TFile } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { StrictMode, useState, useEffect, useRef, useCallback } from "react";
import { DiscourseNode } from "~/types";
import type DiscourseGraphPlugin from "~/index";
import { QueryEngine } from "~/services/QueryEngine";

type CreateNodeFormProps = {
  nodeTypes: DiscourseNode[];
  onNodeCreate: (nodeType: DiscourseNode, title: string) => Promise<void>;
  onCancel: () => void;
  initialTitle?: string;
  initialNodeType?: DiscourseNode;
  plugin: DiscourseGraphPlugin;
};

export const CreateNodeForm = ({
  nodeTypes,
  onNodeCreate,
  onCancel,
  initialTitle = "",
  initialNodeType,
  plugin,
}: CreateNodeFormProps) => {
  const [title, setTitle] = useState(initialTitle);
  const [selectedNodeType, setSelectedNodeType] =
    useState<DiscourseNode | null>(initialNodeType || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedExistingNode, setSelectedExistingNode] =
    useState<TFile | null>(null);
  const [query, setQuery] = useState(initialTitle);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(false);
  const [searchResults, setSearchResults] = useState<TFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const queryEngine = useRef(new QueryEngine(plugin.app));
  const titleInputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const debounceTimeoutRef = useRef<number | null>(null);

  // Search for nodes when query changes
  useEffect(() => {
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
  }, [query, selectedNodeType]);

  useEffect(() => {
    if (!selectedExistingNode) {
      setTitle(query);
    }
  }, [query, selectedExistingNode]);

  useEffect(() => {
    if (isFocused && searchResults.length > 0 && query.trim().length >= 2) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
  }, [isFocused, searchResults.length, query]);

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

  const isFormValid = title.trim() && selectedNodeType;

  const handleSelect = useCallback((file: TFile) => {
    setSelectedExistingNode(file);
    setQuery(file.basename);
    setTitle(file.basename);
    setIsOpen(false);
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
      setIsOpen(false);
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
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newQuery = e.target.value;
    setQuery(newQuery);
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
      await onNodeCreate(selectedNodeType, trimmedTitle);
      onCancel();
    } catch (error) {
      console.error("Error creating node:", error);
      new Notice(
        `Error creating node: ${error instanceof Error ? error.message : String(error)}`,
        5000,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    isFormValid,
    isSubmitting,
    onNodeCreate,
    onCancel,
    title,
    selectedNodeType,
  ]);

  return (
    <div>
      <h2>Create Discourse Node</h2>
      <div className="setting-item">
        <div className="setting-item-name">Type</div>
        <div className="setting-item-control">
          <select
            value={selectedNodeType?.id || ""}
            onChange={handleNodeTypeChange}
            disabled={isSubmitting}
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
            // Search input with popover
            <div className="relative w-full">
              <input
                ref={titleInputRef}
                type="text"
                placeholder={
                  selectedNodeType
                    ? `Search for existing ${selectedNodeType.name.toLowerCase()} or enter new content`
                    : "Search for existing nodes or enter new content"
                }
                value={query}
                onChange={handleQueryChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  // Delay closing to allow click on menu item
                  setTimeout(() => setIsFocused(false), 200);
                }}
                disabled={isSubmitting}
                className="resize-vertical font-inherit border-background-modifier-border bg-background-primary text-text-normal max-h-[6em] min-h-[2.5em] w-full overflow-y-auto rounded-md border p-2"
                autoComplete="off"
              />
              {isOpen && (
                <div
                  ref={popoverRef}
                  className="suggestion-container"
                  style={{
                    position: "fixed",
                    zIndex: 1000,
                    maxHeight: "256px",
                    overflowY: "auto",
                    backgroundColor: "var(--background-primary)",
                    border: "1px solid var(--background-modifier-border)",
                    borderRadius: "var(--radius-s)",
                    boxShadow: "var(--shadow-s)",
                    marginTop: "4px",
                  }}
                >
                  <ul
                    ref={menuRef}
                    className="suggestion-list"
                    style={{
                      listStyle: "none",
                      margin: 0,
                      padding: "4px 0",
                    }}
                  >
                    {isSearching ? (
                      <li
                        className="suggestion-item"
                        style={{
                          padding: "8px 12px",
                          color: "var(--text-muted)",
                        }}
                      >
                        Searching...
                      </li>
                    ) : searchResults.length === 0 ? (
                      <li
                        className="suggestion-item"
                        style={{
                          padding: "8px 12px",
                          color: "var(--text-muted)",
                        }}
                      >
                        No results found
                      </li>
                    ) : (
                      searchResults.map((file, index) => (
                        <li
                          key={file.path}
                          className={`suggestion-item ${
                            index === activeIndex ? "is-selected" : ""
                          }`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelect(file);
                          }}
                          onMouseEnter={() => setActiveIndex(index)}
                          style={{
                            padding: "8px 12px",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            backgroundColor:
                              index === activeIndex
                                ? "var(--background-modifier-hover)"
                                : "transparent",
                          }}
                        >
                          {/* <span>📄</span> */}
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

      <div
        className="modal-button-container"
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          marginTop: "20px",
        }}
      >
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
          {isSubmitting ? "Creating..." : "Confirm"}
        </button>
      </div>
    </div>
  );
};

type CreateNodeModalProps = {
  nodeTypes: DiscourseNode[];
  plugin: DiscourseGraphPlugin;
  onNodeCreate: (nodeType: DiscourseNode, title: string) => Promise<void>;
  initialTitle?: string;
  initialNodeType?: DiscourseNode;
};

export class CreateNodeModal extends Modal {
  private nodeTypes: DiscourseNode[];
  private onNodeCreate: (
    nodeType: DiscourseNode,
    title: string,
  ) => Promise<void>;
  private root: Root | null = null;
  private initialTitle?: string;
  private initialNodeType?: DiscourseNode;
  private plugin: DiscourseGraphPlugin;

  constructor(app: App, props: CreateNodeModalProps) {
    super(app);
    this.nodeTypes = props.nodeTypes;
    this.onNodeCreate = props.onNodeCreate;
    this.initialTitle = props.initialTitle;
    this.initialNodeType = props.initialNodeType;
    this.plugin = props.plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.root = createRoot(contentEl);
    this.root.render(
      <StrictMode>
        <CreateNodeForm
          nodeTypes={this.nodeTypes}
          onNodeCreate={this.onNodeCreate}
          onCancel={() => this.close()}
          initialTitle={this.initialTitle}
          initialNodeType={this.initialNodeType}
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
