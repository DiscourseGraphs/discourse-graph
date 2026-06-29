import { App, Modal } from "obsidian";
import { StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";

export abstract class ReactRootModal extends Modal {
  private root: Root | null = null;

  constructor(app: App) {
    super(app);
  }

  protected abstract renderContent(): ReactNode;

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    this.root = createRoot(contentEl);
    this.root.render(<StrictMode>{this.renderContent()}</StrictMode>);
  }

  onClose(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
