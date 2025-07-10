import { App, Modal, Notice } from "obsidian";
import { createRoot, Root } from "react-dom/client";
import { StrictMode, useState, useEffect, useRef } from "react";
import { DiscourseNode } from "~/types";
import type DiscourseGraphPlugin from "~/index";

type CreateNodeFormProps = {
  nodeTypes: DiscourseNode[];
  plugin: DiscourseGraphPlugin;
  onNodeCreate: (nodeType: DiscourseNode, title: string) => Promise<void>;
  onCancel: () => void;
  initialTitle?: string;
  initialNodeType?: DiscourseNode;
};

export function CreateNodeForm({
  nodeTypes,
  plugin,
  onNodeCreate,
  onCancel,
  initialTitle = "",
  initialNodeType,
}: CreateNodeFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [selectedNodeType, setSelectedNodeType] =
    useState<DiscourseNode | null>(initialNodeType || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Focus the title input when component mounts
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 50);
  }, []);

  const isFormValid = title.trim() && selectedNodeType;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && isFormValid && !isSubmitting) {
      e.preventDefault();
      handleConfirm();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  const handleNodeTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    setSelectedNodeType(nodeTypes.find((nt) => nt.id === selectedId) || null);
  };

  const handleConfirm = async () => {
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
      onCancel(); // Close the modal on success
    } catch (error) {
      console.error("Error creating node:", error);
      new Notice(
        `Error creating node: ${error instanceof Error ? error.message : String(error)}`,
        5000,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <h2>Create Discourse Node</h2>

      <div className="setting-item">
        <div className="setting-item-name">Title</div>
        <div className="setting-item-control">
          <input
            ref={titleInputRef}
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            className="resize-vertical font-inherit border-background-modifier-border bg-background-primary text-text-normal max-h-[6em] min-h-[2.5em] w-full overflow-y-auto rounded-md border p-2"
          />
        </div>
      </div>

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
          onClick={handleConfirm}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting ? "Creating..." : "Confirm"}
        </button>
      </div>
    </div>
  );
}

type CreateNodeModalProps = {
  nodeTypes: DiscourseNode[];
  plugin: DiscourseGraphPlugin;
  onNodeCreate: (nodeType: DiscourseNode, title: string) => Promise<void>;
  initialTitle?: string;
  initialNodeType?: DiscourseNode;
};

export class CreateNodeModal extends Modal {
  private nodeTypes: DiscourseNode[];
  private plugin: DiscourseGraphPlugin;
  private onNodeCreate: (
    nodeType: DiscourseNode,
    title: string,
  ) => Promise<void>;
  private root: Root | null = null;
  private initialTitle?: string;
  private initialNodeType?: DiscourseNode;

  constructor(app: App, props: CreateNodeModalProps) {
    super(app);
    this.nodeTypes = props.nodeTypes;
    this.plugin = props.plugin;
    this.onNodeCreate = props.onNodeCreate;
    this.initialTitle = props.initialTitle;
    this.initialNodeType = props.initialNodeType;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    this.root = createRoot(contentEl);
    this.root.render(
      <StrictMode>
        <CreateNodeForm
          nodeTypes={this.nodeTypes}
          plugin={this.plugin}
          onNodeCreate={this.onNodeCreate}
          onCancel={() => this.close()}
          initialTitle={this.initialTitle}
          initialNodeType={this.initialNodeType}
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
