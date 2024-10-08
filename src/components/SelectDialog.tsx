import React, { useRef, useEffect } from "react";
import {
  Dialog,
  Button,
  Classes,
  IconName,
  MaybeElement,
} from "@blueprintjs/core";
import renderOverlay from "roamjs-components/util/renderOverlay";

type SelectItem = {
  id: string;
  text: string;
  icon?: IconName | MaybeElement;
  onClick: () => void;
};

type SelectDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: SelectItem[];
  errorMessage?: string;
  width?: string;
};

const SelectDialog = ({
  isOpen,
  onClose,
  title,
  items,
  errorMessage,
  width = "20rem",
}: SelectDialogProps) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      canOutsideClickClose
      canEscapeKeyClose
      className="roamjs-canvas-dialog"
      style={{ width }}
    >
      <div className={`${Classes.DIALOG_BODY} py-4 px-0 m-0`}>
        <div className="flex flex-col">
          <div className="text-lg font-bold p-2 mb-2 mx-5 mt-0">{title}</div>
          <button
            // Visually hidden button to catch initial focus
            // this allows the Dialog to be called via command palette WITH the keyboard
            // then use keyboard arrow keys to navigate
            className="sr-only"
            tabIndex={0}
            aria-hidden="true"
          />
          {items.length > 0 ? (
            items.map((item, i) => (
              <div key={item.id} className="flex items-center">
                <Button
                  minimal
                  text={item.text}
                  className="p-2 px-7 focus:outline-none focus:bg-gray-300 justify-start flex-grow"
                  icon={item.icon}
                  style={{
                    caretColor: "transparent",
                  }}
                  onClick={() => {
                    item.onClick();
                    onClose();
                  }}
                />
              </div>
            ))
          ) : (
            <div className="p-4 text-center">
              {errorMessage || "No items available"}
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export const renderSelectDialog = (props: SelectDialogProps) =>
  renderOverlay({ Overlay: SelectDialog, props });
