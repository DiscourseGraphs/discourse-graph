import { App, Modal } from "obsidian";

interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  // Called when the modal closes without confirmation.
  onCancel?: () => void;
}

export class ConfirmationModal extends Modal {
  private title: string;
  private message: string;
  private onConfirm: () => void;
  private onCancel?: () => void;
  private confirmed = false;

  constructor(
    app: App,
    { title, message, onConfirm, onCancel }: ConfirmationModalProps,
  ) {
    super(app);
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
    this.onCancel = onCancel;
  }

  onOpen() {
    const { contentEl } = this;

    contentEl.createEl("h2", { text: this.title });
    contentEl.createEl("p", { text: this.message });

    const buttonContainer = contentEl.createDiv({
      cls: "modal-button-container",
    });

    buttonContainer
      .createEl("button", {
        text: "Cancel",
        cls: "mod-normal",
      })
      .addEventListener("click", () => {
        this.close();
      });

    buttonContainer
      .createEl("button", {
        text: "Confirm",
        cls: "mod-warning",
      })
      .addEventListener("click", () => {
        this.confirmed = true;
        this.onConfirm();
        this.close();
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    if (!this.confirmed) this.onCancel?.();
  }
}
