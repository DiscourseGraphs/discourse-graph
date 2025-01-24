import { App, Modal } from "obsidian";
import { createRoot } from "react-dom/client";

const ModalComponent = ({ context }: { context: Modal }) => {
  return (
    <div className="">
      <h2 className="">SO RED</h2>
      <p>Lorum ipsum dolor sit amet.</p>
      <button
        className=""
        onClick={() => {
          context.close();
        }}
      >
        Click me to close
      </button>
    </div>
  );
};

export class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    const root = createRoot(contentEl);
    root.render(<ModalComponent context={this} />);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
