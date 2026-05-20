import React, { useCallback, useEffect, useState } from "react";
import { Dialog } from "@blueprintjs/core";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import renderOverlay, {
  RoamOverlayProps,
} from "roamjs-components/util/renderOverlay";
import { getCanvasPageTitles } from "~/utils/isCanvasPage";

type CanvasEmbedDialogProps = {
  onSelect: (title: string) => void;
};

const CanvasEmbedDialog = ({
  isOpen,
  onClose,
  onSelect,
}: RoamOverlayProps<CanvasEmbedDialogProps>) => {
  const [canvasPages, setCanvasPages] = useState<string[] | null>(null);

  useEffect(() => {
    void getCanvasPageTitles().then(setCanvasPages);
  }, []);

  const handleSetValue = useCallback(
    (title: string) => {
      if (canvasPages?.includes(title)) {
        onSelect(title);
        onClose();
      }
    },
    [canvasPages, onSelect, onClose],
  );

  const renderContent = () => {
    if (canvasPages === null)
      return (
        <div className="dg-canvas-embed-dialog-message">
          Loading canvas pages...
        </div>
      );
    if (canvasPages.length === 0)
      return (
        <div className="dg-canvas-embed-dialog-message">
          No canvas pages found
        </div>
      );
    return (
      <AutocompleteInput
        setValue={handleSetValue}
        options={canvasPages}
        placeholder="Search canvas pages..."
        autoFocus
        autoSelectFirstOption={false}
      />
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Embed Canvas"
      className="dg-canvas-embed-dialog"
    >
      <div className="dg-canvas-embed-dialog-body">{renderContent()}</div>
    </Dialog>
  );
};

export const renderCanvasEmbedDialog = (props: CanvasEmbedDialogProps) =>
  renderOverlay({
    // eslint-disable-next-line @typescript-eslint/naming-convention
    Overlay: CanvasEmbedDialog,
    props,
  });
