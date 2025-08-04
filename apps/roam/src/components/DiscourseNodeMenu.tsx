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
  isShift?: boolean;
};

const NodeMenu = ({
  onClose,
  textarea,
  extensionAPI,
  trigger,
  isShift,
}: { onClose: () => void } & Props) => {
  const isInitialTextSelected =
    textarea.selectionStart !== textarea.selectionEnd;

  const [showNodeTypes, setShowNodeTypes] = useState(
    isInitialTextSelected || (isShift ?? false),
  );
  const userDiscourseNodes = useMemo(
    () => getDiscourseNodes().filter((n) => n.backedBy === "user"),
    [],
  );
  const discourseNodes = userDiscourseNodes.filter(
    (n) => showNodeTypes || n.tag,
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
    (index: number) => {
      const menuItem =
        menuRef.current?.children[index].querySelector(".bp3-menu-item");
      if (!menuItem) return;

      if (showNodeTypes) {
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
      } else {
        const tag = menuItem.getAttribute("data-tag") || "";
        if (!tag) return;

        setTimeout(() => {
          const currentText = textarea.value;
          const cursorPos = textarea.selectionStart;
          const textToInsert = `#${tag} `;

          const newText = `${currentText.substring(
            0,
            cursorPos,
          )}${textToInsert}${currentText.substring(cursorPos)}`;

          updateBlock({ text: newText, uid: blockUid });
          posthog.capture("Discourse Tag: Created via Node Menu", {
            tag,
          });
        });
      }
      onClose();
    },
    [menuRef, blockUid, onClose, textarea, extensionAPI, showNodeTypes],
  );

  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen || e.metaKey || e.ctrlKey) return;
      if (e.key === "Shift") {
        if (!isInitialTextSelected) {
          setShowNodeTypes(true);
        }
        return;
      }

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
        // Remove focus from the block to ensure updateBlock works properly
        document.body.click();
      } else if (e.key === "Escape") {
        onClose();
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
    [onSelect, onClose, indexBySC, isOpen, isInitialTextSelected],
  );

  const keyupListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Shift" && !isInitialTextSelected) {
        setShowNodeTypes(false);
      }
    },
    [isInitialTextSelected],
  );

  useEffect(() => {
    const eventTarget = trigger ? document : textarea;
    const keydownHandler = (e: Event) => {
      keydownListener(e as KeyboardEvent);
    };

    eventTarget.addEventListener("keydown", keydownHandler);
    eventTarget.addEventListener("keyup", keyupListener as EventListener);

    if (!trigger) {
      textarea.addEventListener("input", onClose);
    }

    return () => {
      eventTarget.removeEventListener("keydown", keydownHandler);
      eventTarget.removeEventListener("keyup", keyupListener as EventListener);
      if (!trigger) {
        textarea.removeEventListener("input", onClose);
      }
    };
  }, [
    keydownListener,
    keyupListener,
    onClose,
    textarea,
    trigger,
    isInitialTextSelected,
  ]);

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
      className="relative z-50"
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
                data-tag={item.tag}
                text={
                  showNodeTypes ? item.text : item.tag ? `#${item.tag}` : ""
                }
                active={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => onSelect(i)}
                disabled={!showNodeTypes && !item.tag}
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
  const trigger = (
    <Button
      small
      className="relative z-50 rounded border border-[#d3d8de] bg-white px-2 py-1 shadow-md hover:border-[#bfccd6] hover:bg-[#f7f9fc]"
      icon={
        <div className="flex items-center gap-1">
          <svg
            width="18"
            height="19"
            viewBox="0 0 256 264"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M156.705 252.012C140.72 267.995 114.803 267.995 98.8183 252.012L11.9887 165.182C-3.99622 149.197 -3.99622 123.28 11.9886 107.296L55.4035 63.8807C63.3959 55.8881 76.3541 55.8881 84.3467 63.8807C92.3391 71.8731 92.3391 84.8313 84.3467 92.8239L69.8751 107.296C53.8901 123.28 53.8901 149.197 69.8751 165.182L113.29 208.596C121.282 216.589 134.241 216.589 142.233 208.596C150.225 200.604 150.225 187.646 142.233 179.653L127.761 165.182C111.777 149.197 111.777 123.28 127.761 107.296C143.746 91.3105 143.746 65.3939 127.761 49.4091L113.29 34.9375C105.297 26.9452 105.297 13.9868 113.29 5.99432C121.282 -1.99811 134.241 -1.99811 142.233 5.99434L243.533 107.296C259.519 123.28 259.519 149.197 243.533 165.182L156.705 252.012ZM200.119 121.767C192.127 113.775 179.168 113.775 171.176 121.767C163.184 129.76 163.184 142.718 171.176 150.71C179.168 158.703 192.127 158.703 200.119 150.71C208.112 142.718 208.112 129.76 200.119 121.767Z"
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
      isShift
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
