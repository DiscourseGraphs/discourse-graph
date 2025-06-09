import { App, Modal, Notice } from "obsidian";
import { DiscourseNode } from "~/types";
import type DiscourseGraphPlugin from "~/index";

interface CreateNodeModalProps {
  nodeTypes: DiscourseNode[];
  plugin: DiscourseGraphPlugin;
  onNodeCreate: (nodeType: DiscourseNode, title: string) => Promise<void>;
}

export class CreateNodeModal extends Modal {
  private nodeTypes: DiscourseNode[];
  private plugin: DiscourseGraphPlugin;
  private onNodeCreate: (
    nodeType: DiscourseNode,
    title: string,
  ) => Promise<void>;
  private selectedNodeType: DiscourseNode | null = null;
  private titleInput: HTMLInputElement | null = null;
  private confirmButton: HTMLButtonElement | null = null;

  constructor(app: App, props: CreateNodeModalProps) {
    super(app);
    this.nodeTypes = props.nodeTypes;
    this.plugin = props.plugin;
    this.onNodeCreate = props.onNodeCreate;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Create node" });

    const titleContainer = contentEl.createDiv({ cls: "setting-item" });
    titleContainer.createEl("div", { text: "Title", cls: "setting-item-name" });
    const titleInputContainer = titleContainer.createDiv({
      cls: "setting-item-control",
    });

    this.titleInput = titleInputContainer.createEl("input", {
      type: "text",
      placeholder: "Title",
    });
    this.titleInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this.handleConfirm();
      } else if (e.key === "Escape") {
        e.preventDefault();
        this.close();
      }
    });
    this.titleInput.addEventListener("input", () => {
      this.updateButtonState();
    });

    const typeContainer = contentEl.createDiv({ cls: "setting-item" });
    typeContainer.createEl("div", { text: "Type", cls: "setting-item-name" });
    const typeInputContainer = typeContainer.createDiv({
      cls: "setting-item-control",
    });

    const typeSelect = typeInputContainer.createEl("select");
    typeSelect.createEl("option", { text: "Select node type", value: "" });
    this.nodeTypes.forEach((nodeType) => {
      typeSelect.createEl("option", {
        text: nodeType.name,
        value: nodeType.id,
      });
    });
    typeSelect.addEventListener("change", () => {
      const selectedId = typeSelect.value;
      this.selectedNodeType =
        this.nodeTypes.find((nt) => nt.id === selectedId) || null;
      this.updateButtonState();
    });

    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
    });
    buttonContainer.style.display = "flex";
    buttonContainer.style.justifyContent = "flex-end";
    buttonContainer.style.gap = "8px";
    buttonContainer.style.marginTop = "20px";

    const cancelButton = buttonContainer.createEl("button", {
      text: "Cancel",
      cls: "mod-normal",
    });
    cancelButton.addEventListener("click", () => {
      this.close();
    });

    this.confirmButton = buttonContainer.createEl("button", {
      text: "Confirm",
      cls: "mod-cta",
    });
    this.confirmButton.disabled = true;
    this.confirmButton.addEventListener("click", () => {
      this.handleConfirm();
    });

    setTimeout(() => this.titleInput?.focus(), 50);
    this.updateButtonState();
  }

  private updateButtonState() {
    if (this.confirmButton) {
      const hasTitle = this.titleInput?.value.trim();
      const hasNodeType = this.selectedNodeType;
      this.confirmButton.disabled = !hasTitle || !hasNodeType;
    }
  }

  private async handleConfirm() {
    if (!this.titleInput || !this.selectedNodeType) {
      return;
    }

    const title = this.titleInput.value.trim();
    if (!title) {
      new Notice("Please enter a title", 3000);
      return;
    }

    try {
      await this.onNodeCreate(this.selectedNodeType, title);
      this.close();
    } catch (error) {
      console.error("Error creating node:", error);
      new Notice(
        `Error creating node: ${error instanceof Error ? error.message : String(error)}`,
        5000,
      );
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
