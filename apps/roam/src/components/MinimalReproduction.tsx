import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Dialog,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
} from "@blueprintjs/core";

const PRECONFIGURED_MENU_ITEMS = [
  { text: "Option Alpha", id: "alpha" },
  { text: "Option Beta", id: "beta" },
  { text: "Option Gamma", id: "gamma" },
];

const MinimalFormDialog = ({
  onSubmit,
}: {
  onSubmit: (value: string) => void;
}) => {
  const [value, setValue] = useState("");

  return (
    <Dialog isOpen={true} isCloseButtonShown={false}>
      <div className="bp3-dialog-body">
        <InputGroup
          value={value}
          autoFocus={true}
          onChange={(e) => setValue(e.target.value)}
        />
      </div>
      <div className="bp3-dialog-footer">
        <Button text="Submit" onClick={() => onSubmit(value)} />
      </div>
    </Dialog>
  );
};

export const renderMinimalFormDialog = ({
  updateBlock,
}: {
  updateBlock: (value: string) => void;
}) => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  ReactDOM.render(
    <MinimalFormDialog
      onSubmit={(value) => {
        updateBlock(value);
        ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) {
          container.parentNode.removeChild(container);
        }
      }}
    />,
    container,
  );
};

export const NodeMenu = ({
  onClose,
  textarea,
}: {
  onClose: () => void;
  textarea: HTMLTextAreaElement;
}) => {
  const id = textarea.id;
  const blockUid = id.substring(id.length - 9, id.length);

  const onSelectMenuItem = (index: number) => {
    const selectedItem = PRECONFIGURED_MENU_ITEMS[index];
    if (!selectedItem) return;

    onClose();

    renderMinimalFormDialog({
      updateBlock: (dialogValue: string) => {
        if (dialogValue && blockUid) {
          window.roamAlphaAPI.data.block.update({
            block: {
              string: dialogValue,
              uid: blockUid,
            },
          });
          console.log(
            `window.roamAlphaAPI.data.block.update({
              block: {
                string: "${dialogValue}",
                uid: "${blockUid}",
              },
            });`,
          );
        }
      },
    });
  };

  const keydownListener = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      onSelectMenuItem(0);
      e.stopPropagation();
      e.preventDefault();
    }
  };

  useEffect(() => {
    textarea.addEventListener("keydown", keydownListener, true);
    return () => textarea.removeEventListener("keydown", keydownListener);
  }, [keydownListener]);

  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      minimal
      target={<span />}
      position="bottom-left"
      autoFocus={false}
      enforceFocus={false}
      content={
        <Menu>
          {PRECONFIGURED_MENU_ITEMS.map((item, i) => {
            return (
              <MenuItem
                key={item.id}
                text={item.text}
                active={i === 0}
                onClick={() => onSelectMenuItem(0)}
              />
            );
          })}
        </Menu>
      }
    />
  );
};

export const render = (textarea: HTMLTextAreaElement) => {
  const parent = document.createElement("span");
  textarea.parentElement?.insertBefore(parent, textarea);
  ReactDOM.render(
    <NodeMenu
      textarea={textarea}
      onClose={() => {
        ReactDOM.unmountComponentAtNode(parent);
        parent.remove();
      }}
    />,
    parent,
  );
};

// export const initializeNodeMenuTrigger = () => {
//   const handleNodeMenuRender = (target: HTMLElement, evt: KeyboardEvent) => {
//     if (
//       target.tagName === "TEXTAREA" &&
//       target.classList.contains("rm-block-input")
//     ) {
//       render(target as HTMLTextAreaElement);
//       evt.preventDefault();
//       evt.stopPropagation();
//     }
//   };

//   const nodeMenuTriggerListener = (e: Event) => {
//     const evt = e as KeyboardEvent;
//     const target = evt.target as HTMLElement;

//     if (evt.key === "\\") {
//       handleNodeMenuRender(target, evt);
//     }
//   };

//   document.addEventListener("keydown", nodeMenuTriggerListener);
//   return () => document.removeEventListener("keydown", nodeMenuTriggerListener);
// };
