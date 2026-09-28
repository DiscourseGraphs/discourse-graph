import { App, Modal } from "obsidian";
import { StrictMode, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { ColorPicker } from "~/components/RelationshipTypeSettings";
import type { DiscourseRelationType } from "~/types";
import {
  DEFAULT_TLDRAW_COLOR,
  type TldrawColorName,
} from "~/utils/tldrawColors";
import { getRelationTypeErrors } from "~/utils/typeUtils";

type RelationTypeFields = {
  label: string;
  complement: string;
  color: TldrawColorName;
};

type CreateRelationTypeFormProps = {
  relationTypes: DiscourseRelationType[];
  onSubmit: (fields: RelationTypeFields) => Promise<void>;
  onClose: () => void;
};

const CreateRelationTypeForm = ({
  relationTypes,
  onSubmit,
  onClose,
}: CreateRelationTypeFormProps) => {
  const [label, setLabel] = useState("");
  const [complement, setComplement] = useState("");
  const [color, setColor] = useState<TldrawColorName>(DEFAULT_TLDRAW_COLOR);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const candidate = {
      id: "new",
      label,
      complement,
      color,
      created: 0,
      modified: 0,
    };
    const nextError = !label
      ? "Label is required"
      : !complement
        ? "Complement is required"
        : (getRelationTypeErrors([...relationTypes, candidate])[
            relationTypes.length
          ] ?? "");
    setError(nextError);
    if (nextError) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ label, complement, color });
    } catch {
      setError("Couldn't save the relation type. Try again.");
      setIsSubmitting(false);
      return;
    }
    onClose();
  };

  const inputClassName = `w-full ${error ? "input-error" : ""}`;

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
    >
      <input
        type="text"
        className={inputClassName}
        placeholder="Label (e.g., supports)"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        autoFocus
      />
      <input
        type="text"
        className={inputClassName}
        placeholder="Complement (e.g., is supported by)"
        value={complement}
        onChange={(e) => setComplement(e.target.value)}
      />
      <ColorPicker value={color} onChange={setColor} />
      {error && <div className="text-error text-xs">{error}</div>}
      <div className="modal-button-container mt-2 flex justify-end gap-2">
        <button
          type="button"
          className="mod-normal"
          onClick={onClose}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button type="submit" className="mod-cta" disabled={isSubmitting}>
          Continue
        </button>
      </div>
    </form>
  );
};

type CreateRelationTypeModalProps = {
  relationTypes: DiscourseRelationType[];
  onSubmit: (fields: RelationTypeFields) => Promise<void>;
  onClose: () => void;
};

export class CreateRelationTypeModal extends Modal {
  private root: Root | null = null;
  private props: CreateRelationTypeModalProps;

  constructor(app: App, props: CreateRelationTypeModalProps) {
    super(app);
    this.props = props;
  }

  onOpen() {
    this.setTitle("Add relation type");
    // The colour list is absolutely positioned and extends past this short form
    this.modalEl.addClass("overflow-visible");
    this.root = createRoot(this.contentEl);
    this.root.render(
      <StrictMode>
        <CreateRelationTypeForm
          relationTypes={this.props.relationTypes}
          onSubmit={this.props.onSubmit}
          onClose={() => this.close()}
        />
      </StrictMode>,
    );
  }

  onClose() {
    this.root?.unmount();
    this.root = null;
    this.contentEl.empty();
    this.props.onClose();
  }
}
