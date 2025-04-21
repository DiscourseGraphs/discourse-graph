import React, { useState, useCallback } from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Intent,
  Label,
} from "@blueprintjs/core";
import updateBlock from "roamjs-components/writes/updateBlock";

interface MinimalFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  nodeName: string;
}

const MinimalFormDialog = ({
  isOpen,
  onClose,
  onSubmit,
  nodeName,
}: MinimalFormDialogProps): React.ReactElement => {
  const [value, setValue] = useState("");

  const handleSubmitClick = useCallback(() => {
    onSubmit(value);
  }, [onSubmit, value]);

  const handleCloseClick = useCallback(() => {
    onClose();
  }, [onClose]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleCloseClick}
      title={`Create ${nodeName} Node`}
      autoFocus={true}
      enforceFocus={true}
      canEscapeKeyClose={false}
      canOutsideClickClose={false}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          {`Create ${nodeName} Node`}
          <InputGroup
            value={value}
            autoFocus={true}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setValue(e.target.value)
            }
          />
        </Label>
      </div>
      <div className={Classes.DIALOG_FOOTER}>
        <div className={Classes.DIALOG_FOOTER_ACTIONS}>
          <Button text="Cancel" onClick={handleCloseClick} />
          <Button
            intent={Intent.PRIMARY}
            text="Submit"
            onClick={handleSubmitClick}
          />
        </div>
      </div>
    </Dialog>
  );
};

export const renderMinimalFormDialog = ({
  nodeName,
  resolve,
  blockUid,
}: {
  nodeName: string;
  resolve: (value: string) => void;
  blockUid?: string;
}) => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const unmount = () => {
    ReactDOM.unmountComponentAtNode(container);
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };

  const handleDialogSubmit = async (value: string) => {
    // This makes the solution possible not sure why, maybe the same bug that you talked about in roam.
    setTimeout(() => {
      console.log(
        "handleDialogSubmit: Before updateBlock. Value:",
        value,
        "BlockUID:",
        blockUid,
      );
      unmount();
      resolve(value);
    });
  };

  const handleDialogClose = () => {
    unmount();
    resolve("");
  };

  ReactDOM.render(
    <MinimalFormDialog
      isOpen={true}
      nodeName={nodeName}
      onSubmit={handleDialogSubmit}
      onClose={handleDialogClose}
    />,
    container,
  );
};
