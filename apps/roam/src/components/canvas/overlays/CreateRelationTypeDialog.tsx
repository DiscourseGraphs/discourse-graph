import React, { useState } from "react";
import {
  Button,
  Classes,
  Dialog,
  FormGroup,
  InputGroup,
} from "@blueprintjs/core";
import {
  getNodeTypeText,
  validateNewRelationType,
  type RelationType,
} from "~/components/canvas/existingRelationTypes";
import { getBuiltInConditionKeys } from "~/utils/conditionToDatalog";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import refreshConfigTree from "~/utils/refreshConfigTree";
import { isRelationSchemaDeleted } from "~/utils/relationSchemaChanges";
import type { NodeTypePair } from "./RelationTypeDropdown";

export const CreateRelationTypeDialog = ({
  pair,
  shownLabels,
  onClose,
  onSubmit,
}: {
  pair: NodeTypePair;
  shownLabels: string[];
  onClose: () => void;
  // Resolves true once saved; false keeps the dialog open.
  onSubmit: (relationType: RelationType) => Promise<boolean>;
}): React.ReactElement => {
  const [label, setLabel] = useState("");
  const [complement, setComplement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (): Promise<void> => {
    if (isSaving) return;
    // Saving refreshes the config tree first, so validate against the same data.
    refreshConfigTree();
    const message = validateNewRelationType({
      label,
      complement,
      sourceType: pair.sourceType,
      destinationType: pair.targetType,
      relations: getDiscourseRelations().filter(
        (r) => !isRelationSchemaDeleted(r.id),
      ),
      shownLabels,
      reservedNames: getBuiltInConditionKeys(),
    });
    setError(message);
    if (message) return;
    setIsSaving(true);
    let saved = false;
    try {
      saved = await onSubmit({
        label: label.trim(),
        complement: complement.trim(),
      });
    } finally {
      // On success onClose unmounts the dialog, so only a failure resets the flag.
      if (!saved) setIsSaving(false);
    }
    if (saved) onClose();
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      canEscapeKeyClose={!isSaving}
      canOutsideClickClose={!isSaving}
      isCloseButtonShown={!isSaving}
      title="Add relation type"
      className="w-96"
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSubmit();
        }}
      >
        <div className={Classes.DIALOG_BODY}>
          <p className="text-gray-500">
            {getNodeTypeText(pair.sourceType)} →{" "}
            {getNodeTypeText(pair.targetType)}
          </p>
          <FormGroup label="Label" labelFor="dg-new-relation-label">
            <InputGroup
              id="dg-new-relation-label"
              autoFocus
              placeholder="e.g. supports"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </FormGroup>
          <FormGroup label="Complement" labelFor="dg-new-relation-complement">
            <InputGroup
              id="dg-new-relation-complement"
              placeholder="e.g. is supported by"
              value={complement}
              onChange={(e) => setComplement(e.target.value)}
            />
          </FormGroup>
          {error && <div className="text-red-700">{error}</div>}
        </div>
        <div className={Classes.DIALOG_FOOTER}>
          <div className={Classes.DIALOG_FOOTER_ACTIONS}>
            <Button text="Cancel" onClick={onClose} disabled={isSaving} />
            <Button
              type="submit"
              intent="primary"
              text="Continue"
              loading={isSaving}
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
};
