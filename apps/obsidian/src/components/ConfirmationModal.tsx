import { App, Modal } from "obsidian";

interface ConfirmationModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
}

export class ConfirmationModal extends Modal {
  private title: string;
  private message: string;
  private onConfirm: () => void;

  constructor(app: App, { title, message, onConfirm }: ConfirmationModalProps) {
    super(app);
    this.title = title;
    this.message = message;
    this.onConfirm = onConfirm;
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
        this.onConfirm();
        this.close();
      });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
