import {
  Menu,
  MenuItem,
  Popover,
  Position,
  Button,
  InputGroup,
  getKeyCombo,
  IKeyCombo,
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
};

const NodeMenu = ({
  onClose,
  textarea,
  extensionAPI,
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
    [menuRef, blockUid, onClose],
  );
  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        const index = Number(
          menuRef.current?.getAttribute("data-active-index"),
        );
        const count = menuRef.current?.childElementCount || 0;
        setActiveIndex((index + 1) % count);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
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
        // Remove focus from the block to ensure updateBlock works properly
        document.body.click();
      } else if (shortcuts.has(e.key.toUpperCase())) {
        onSelect(indexBySC[e.key.toUpperCase()]);
        // Remove focus from the block to ensure updateBlock works properly
        document.body.click();
      } else {
        return;
      }
      e.stopPropagation();
      e.preventDefault();
    },
    [menuRef, setActiveIndex],
  );
  useEffect(() => {
    textarea.addEventListener("keydown", keydownListener);
    textarea.addEventListener("input", onClose);
    return () => {
      textarea.removeEventListener("keydown", keydownListener);
      textarea.removeEventListener("input", onClose);
    };
  }, [keydownListener, onClose]);
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
