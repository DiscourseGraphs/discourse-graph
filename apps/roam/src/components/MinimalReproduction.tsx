import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import ReactDOM from "react-dom";
import {
  Button,
  Classes,
  Dialog,
  InputGroup,
  Label,
  Menu,
  MenuItem,
  Popover,
  Position,
} from "@blueprintjs/core";
import updateBlock from "roamjs-components/writes/updateBlock";
import getUids from "roamjs-components/dom/getUids";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";

interface MinimalFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
  title: string;
}

const MinimalFormDialog = ({
  isOpen,
  onClose,
  onSubmit,
  title,
}: MinimalFormDialogProps): React.ReactElement => {
  const [value, setValue] = useState("");

  const handleSubmitClick = useCallback(() => {
    onSubmit(value);
  }, [onSubmit, value]);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      autoFocus={true}
      enforceFocus={true}
      canEscapeKeyClose={true}
      canOutsideClickClose={true}
    >
      <div className={Classes.DIALOG_BODY}>
        <Label>
          Enter value:
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
          <Button text="Cancel" onClick={onClose} />
          <Button intent="primary" text="Submit" onClick={handleSubmitClick} />
        </div>
      </div>
    </Dialog>
  );
};

export const renderMinimalFormDialog = ({
  title,
  resolve,
}: {
  title: string;
  resolve: (value: string) => void;
}) => {
  const container = document.createElement("div");
  document.body.appendChild(container);

  const unmount = () => {
    ReactDOM.unmountComponentAtNode(container);
    if (container.parentNode) {
      container.parentNode.removeChild(container);
    }
  };

  const handleDialogSubmit = (value: string) => {
    unmount();
    resolve(value);
  };

  const handleDialogClose = () => {
    unmount();
    resolve(""); // Resolve with empty string on cancel or close
  };

  ReactDOM.render(
    <MinimalFormDialog
      isOpen={true}
      title={title}
      onSubmit={handleDialogSubmit}
      onClose={handleDialogClose}
    />,
    container,
  );
};

const PRECONFIGURED_MENU_ITEMS = [
  { text: "Option Alpha", id: "alpha" },
  { text: "Option Beta", id: "beta" },
  { text: "Option Gamma", id: "gamma" },
];

export const NodeMenu = ({
  onClose,
  textarea,
  extensionAPI,
}: { onClose: () => void } & Props) => {
  const menuItems = useMemo(() => PRECONFIGURED_MENU_ITEMS, []);
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);
  const menuRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const onSelectMenuItem = useCallback(
    (index: number) => {
      const selectedItem = menuItems[index];
      if (!selectedItem) return;

      onClose();

      renderMinimalFormDialog({
        title: `Input for ${selectedItem.text}`,
        resolve: (dialogValue: string) => {
          if (dialogValue && blockUid) {
            updateBlock({ text: dialogValue, uid: blockUid });
            console.log(
              `Block ${blockUid} updated with: ${dialogValue} via ${selectedItem.text}`,
            );
          }
        },
      });
    },
    [menuItems, blockUid, onClose],
  );

  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const count = menuItems.length;
        setActiveIndex((prevIndex) => (prevIndex + 1) % count);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        const count = menuItems.length;
        setActiveIndex((prevIndex) => (prevIndex - 1 + count) % count);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === "Enter") {
        onSelectMenuItem(activeIndex);
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === "Escape") {
        onClose();
        e.stopPropagation();
        e.preventDefault();
      }
    },
    [menuItems, activeIndex, onSelectMenuItem, onClose, setActiveIndex],
  );

  useEffect(() => {
    textarea.addEventListener("keydown", keydownListener, true);
    textarea.addEventListener("input", onClose);
    return () => {
      textarea.removeEventListener("keydown", keydownListener);
      textarea.removeEventListener("input", onClose);
    };
  }, [keydownListener, onClose, textarea]);

  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
      autoFocus={false}
      enforceFocus={false}
      content={
        <Menu ulRef={menuRef} data-active-index={activeIndex}>
          {menuItems.map((item, i) => {
            return (
              <MenuItem
                key={item.id}
                text={item.text}
                active={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMenuItem(i);
                }}
                className="flex items-center"
              />
            );
          })}
        </Menu>
      }
    />
  );
};

export const render = (props: Props) => {
  const parent = document.createElement("span");
  const coords = getCoordsFromTextarea(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement?.insertBefore(parent, props.textarea);
  ReactDOM.render(
    <NodeMenu
      {...props}
      onClose={() => {
        ReactDOM.unmountComponentAtNode(parent);
        parent.remove();
      }}
    />,
    parent,
  );
};
