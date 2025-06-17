import {
  Menu,
  MenuItem,
  Popover,
  Position,
  Button,
  InputGroup,
  getKeyCombo,
  IKeyCombo,
  Icon,
} from "@blueprintjs/core";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactDOM from "react-dom";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import getUids from "roamjs-components/dom/getUids";
import updateBlock from "roamjs-components/writes/updateBlock";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import createDiscourseNode from "~/utils/createDiscourseNode";
import { getNewDiscourseNodeText } from "~/utils/formatUtils";
import { OnloadArgs } from "roamjs-components/types";
import { formatHexColor } from "./settings/DiscourseNodeCanvasSettings";
import posthog from "posthog-js";

type Props = {
  textarea: HTMLTextAreaElement;
  extensionAPI: OnloadArgs["extensionAPI"];
  trigger?: JSX.Element;
};

const NodeMenu = ({
  onClose,
  textarea,
  extensionAPI,
  trigger,
}: { onClose: () => void } & Props) => {
  const discourseNodes = useMemo(
    () => getDiscourseNodes().filter((n) => n.backedBy === "user"),
    [],
  );
  const indexBySC = useMemo(
    () => Object.fromEntries(discourseNodes.map((mi, i) => [mi.shortcut, i])),
    [discourseNodes],
  );
  const shortcuts = useMemo(() => new Set(Object.keys(indexBySC)), [indexBySC]);
  const blockUid = useMemo(() => getUids(textarea).blockUid, [textarea]);
  const menuRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isOpen, setIsOpen] = useState(!trigger);

  const onSelect = useCallback(
    (index) => {
      const menuItem =
        menuRef.current?.children[index].querySelector(".bp3-menu-item");
      if (!menuItem) return;
      const nodeUid = menuItem.getAttribute("data-node") || "";
      const highlighted = textarea.value.substring(
        textarea.selectionStart,
        textarea.selectionEnd,
      );
      setTimeout(async () => {
        const pageName = await getNewDiscourseNodeText({
          text: highlighted,
          nodeType: nodeUid,
          blockUid,
        });

        if (!pageName) {
          return;
        }

        const currentBlockText = getTextByBlockUid(blockUid);
        const newText = `${currentBlockText.substring(
          0,
          textarea.selectionStart,
        )}[[${pageName}]]${currentBlockText.substring(textarea.selectionEnd)}`;

        updateBlock({ text: newText, uid: blockUid });
        posthog.capture("Discourse Node: Created via Node Menu", {
          nodeType: nodeUid,
          text: pageName,
        });

        createDiscourseNode({
          text: pageName,
          configPageUid: nodeUid,
          extensionAPI,
        });
      });
      onClose();
    },
    [menuRef, blockUid, onClose, textarea, extensionAPI],
  );

  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        const index = Number(
          menuRef.current?.getAttribute("data-active-index"),
        );
        const count = menuRef.current?.childElementCount || 0;
        setActiveIndex((index + 1) % count);
      } else if (e.key === "ArrowUp") {
        const index = Number(
          menuRef.current?.getAttribute("data-active-index"),
        );
        const count = menuRef.current?.childElementCount || 0;
        setActiveIndex((index - 1 + count) % count);
      } else if (e.key === "Enter") {
        const index = Number(
          menuRef.current?.getAttribute("data-active-index"),
        );
        onSelect(index);
        document.body.click();
      } else if (e.key === "Escape") {
        onClose();
        document.body.click();
      } else if (shortcuts.has(e.key.toUpperCase())) {
        onSelect(indexBySC[e.key.toUpperCase()]);
        document.body.click();
      } else {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    },
    [menuRef, setActiveIndex, onSelect, shortcuts, indexBySC],
  );
  useEffect(() => {
    textarea.addEventListener("keydown", keydownListener);
    textarea.addEventListener("input", onClose);
    return () => {
      textarea.removeEventListener("keydown", keydownListener);
      textarea.removeEventListener("input", onClose);
    };
  }, [keydownListener, onClose, textarea]);

  const handlePopoverInteraction = useCallback(
    (nextOpenState: boolean) => {
      setIsOpen(nextOpenState);
      if (!nextOpenState) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <Popover
      onClose={onClose}
      isOpen={isOpen}
      canEscapeKeyClose
      minimal
      target={trigger || <span />}
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: false },
        preventOverflow: { enabled: false },
      }}
      autoFocus={false}
      enforceFocus={false}
      onInteraction={trigger ? handlePopoverInteraction : undefined}
      content={
        <Menu ulRef={menuRef} data-active-index={activeIndex}>
          {discourseNodes.map((item, i) => {
            const nodeColor =
              formatHexColor(item?.canvasSettings?.color) || "#000";
            return (
              <MenuItem
                key={item.text}
                data-node={item.type}
                text={item.text}
                active={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => onSelect(i)}
                className="flex items-center"
                icon={
                  <div
                    className="mr-2 h-4 w-4 select-none rounded-full"
                    style={{
                      backgroundColor: nodeColor,
                    }}
                  />
                }
                labelElement={
                  <span className="font-mono">{item.shortcut}</span>
                }
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

export const TextSelectionNodeMenu = ({
  textarea,
  extensionAPI,
  onClose,
}: {
  textarea: HTMLTextAreaElement;
  extensionAPI: OnloadArgs["extensionAPI"];
  onClose: () => void;
}) => {
  // Preserve the selection when the popup is created
  const [selection, setSelection] = useState({
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
  });

  useEffect(() => {
    setSelection({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }, []);

  // Restore selection when trigger is clicked
  const handleTriggerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Prevent button from taking focus
      // e.preventDefault();
      // e.stopPropagation();
      textarea.focus();
      textarea.setSelectionRange(selection.start, selection.end);
    },
    [textarea, selection],
  );

  const trigger = (
    <Button
      minimal
      small
      onMouseDown={handleTriggerMouseDown}
      onClick={handleTriggerMouseDown}
      icon={
        <div className="flex items-center gap-1 bg-white">
          <svg
            width="18"
            height="19"
            viewBox="0 0 18 19"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M11.0389 17.7527C9.91285 18.8786 8.08718 18.8786 6.96115 17.7527L0.844529 11.6361C-0.281509 10.51 -0.28151 8.68435 0.844528 7.55832L3.90284 4.50001C4.46586 3.93698 5.37868 3.93698 5.94171 4.50001C6.50473 5.06302 6.50473 5.97585 5.94171 6.53888L4.92228 7.55832C3.79623 8.68435 3.79623 10.51 4.92228 11.6361L7.98057 14.6944C8.5436 15.2574 9.45643 15.2574 10.0194 14.6944C10.5825 14.1313 10.5825 13.2185 10.0194 12.6555L9.00001 11.6361C7.87398 10.51 7.87398 8.68435 9.00001 7.55832C10.1261 6.43227 10.1261 4.6066 9.00001 3.48057L7.98057 2.46114C7.41756 1.89812 7.41756 0.985283 7.98057 0.422263C8.5436 -0.140755 9.45643 -0.140754 10.0194 0.422265L17.1555 7.55832C18.2815 8.68435 18.2815 10.51 17.1555 11.6361L11.0389 17.7527ZM14.0972 8.57776C13.5342 8.01473 12.6213 8.01473 12.0583 8.57776C11.4953 9.14077 11.4953 10.0536 12.0583 10.6166C12.6213 11.1796 13.5342 11.1796 14.0972 10.6166C14.6602 10.0536 14.6602 9.14077 14.0972 8.57776Z"
              fill="#555555"
            />
          </svg>
          <Icon icon="chevron-down" size={16} color="#555555" />
        </div>
      }
    />
  );

  return (
    <NodeMenu
      textarea={textarea}
      extensionAPI={extensionAPI}
      trigger={trigger}
      onClose={onClose}
    />
  );
};

// node_modules\@blueprintjs\core\lib\esm\components\hotkeys\hotkeyParser.js
const isMac = () => {
  const platform =
    typeof navigator !== "undefined" ? navigator.platform : undefined;
  return platform == null ? false : /Mac|iPod|iPhone|iPad/.test(platform);
};
const MODIFIER_BIT_MASKS = {
  alt: 1,
  ctrl: 2,
  meta: 4,
  shift: 8,
};
const ALIASES: { [key: string]: string } = {
  cmd: "meta",
  command: "meta",
  escape: "esc",
  minus: "-",
  mod: isMac() ? "meta" : "ctrl",
  option: "alt",
  plus: "+",
  return: "enter",
  win: "meta",
};
const normalizeKeyCombo = (combo: string) => {
  const keys = combo.replace(/\s/g, "").split("+");
  return keys.map(function (key) {
    const keyName = ALIASES[key] != null ? ALIASES[key] : key;
    return keyName === "meta" ? (isMac() ? "cmd" : "win") : keyName;
  });
};

export const getModifiersFromCombo = (comboKey: IKeyCombo) => {
  if (!comboKey) return [];
  return [
    comboKey.modifiers & MODIFIER_BIT_MASKS.alt && "alt",
    comboKey.modifiers & MODIFIER_BIT_MASKS.ctrl && "ctrl",
    comboKey.modifiers & MODIFIER_BIT_MASKS.shift && "shift",
    comboKey.modifiers & MODIFIER_BIT_MASKS.meta && "meta",
  ].filter(Boolean);
};

export const NodeMenuTriggerComponent = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [comboKey, setComboKey] = useState<IKeyCombo>(
    () =>
      (extensionAPI.settings.get(
        "personal-node-menu-trigger",
      ) as IKeyCombo) || { modifiers: 0, key: "" },
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const comboObj = getKeyCombo(e.nativeEvent);
      if (!comboObj.key) return;

      setComboKey({ key: comboObj.key, modifiers: comboObj.modifiers });
      extensionAPI.settings.set("personal-node-menu-trigger", comboObj);
    },
    [extensionAPI],
  );

  const shortcut = useMemo(() => {
    if (!comboKey.key) return "";

    const modifiers = getModifiersFromCombo(comboKey);
    const comboString = [...modifiers, comboKey.key].join("+");
    return normalizeKeyCombo(comboString).join("+");
  }, [comboKey]);

  return (
    <InputGroup
      inputRef={inputRef}
      placeholder={isActive ? "Press keys ..." : "Click to set trigger"}
      value={shortcut}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      rightElement={
        <Button
          hidden={!comboKey.key}
          icon={"remove"}
          onClick={() => {
            setComboKey({ modifiers: 0, key: "" });
            extensionAPI.settings.set("personal-node-menu-trigger", "");
          }}
          minimal
        />
      }
    />
  );
};

export default NodeMenu;
