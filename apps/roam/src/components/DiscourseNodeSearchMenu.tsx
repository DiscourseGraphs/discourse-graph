import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Menu, MenuItem, Popover, Position } from "@blueprintjs/core";
import ReactDOM from "react-dom";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import posthog from "posthog-js";
import { OnloadArgs } from "roamjs-components/types/native";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerPosition: number;
  onClose: () => void;
};

type DiscourseType = {
  type: string;
  title: string;
  items: { id: string; text: string }[];
};

// Hardcoded discourse types for testing
// TODO: replace with actual discourse types
const DISCOURSE_TYPES: DiscourseType[] = [
  {
    type: "claims",
    title: "Claims",
    items: [
      { id: "clm1", text: "[[CLM]] - Claim 1" },
      { id: "clm2", text: "[[CLM]] - Claim 1" },
    ],
  },
  {
    type: "evidence",
    title: "Evidence",
    items: [
      { id: "evd1", text: "[[EVD]] - Evidence 1" },
      { id: "evd2", text: "[[EVD]] - Evidence 2" },
    ],
  },
  {
    type: "results",
    title: "Results",
    items: [
      { id: "res1", text: "[[RES]] - Result 1" },
      { id: "res2", text: "[[RES]] - Result 1" },
    ],
  },
];

const waitForBlock = (
  uid: string,
  text: string,
  retries = 0,
  maxRetries = 30,
): Promise<void> =>
  getTextByBlockUid(uid) === text
    ? Promise.resolve()
    : retries >= maxRetries
      ? Promise.resolve()
      : new Promise((resolve) =>
          setTimeout(
            () => resolve(waitForBlock(uid, text, retries + 1, maxRetries)),
            10,
          ),
        );

const NodeSearchMenu = ({
  onClose,
  textarea,
  triggerPosition,
}: { onClose: () => void } & Props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const menuRef = useRef<HTMLUListElement>(null);
  const { ["block-uid"]: blockUid, ["window-id"]: windowId } = useMemo(
    () =>
      window.roamAlphaAPI.ui.getFocusedBlock() || {
        "block-uid": "",
        "window-id": "",
      },
    [],
  );
  const [cursorPos, setCursorPos] = useState(-1);
  useEffect(() => {
    setCursorPos(textarea.selectionStart);
  }, [textarea]);

  // const handleTextAreaInput = useCallback(() => {
  //   const cursorPos = textarea.selectionStart;
  //   setCursorPos(cursorPos);
  //   if (triggerStartRef.current === -1) {
  //     const textBeforeCursor = textarea.value.substring(0, cursorPos);
  //     const lastAtPos = textBeforeCursor.lastIndexOf("@");

  //     if (lastAtPos !== -1) {
  //       triggerStartRef.current = lastAtPos;
  //     }
  //   }
  //   const newSearchTerm = textarea.value.substring(
  //     triggerStartRef.current + 1,
  //     cursorPos,
  //   );
  //   setSearchTerm(newSearchTerm);
  // }, [textarea]);

  // useEffect(() => {
  //   textarea.addEventListener("input", handleTextAreaInput);
  //   return () => {
  //     textarea.removeEventListener("input", handleTextAreaInput);
  //   };
  // }, [handleTextAreaInput, textarea]);

  const filteredTypes = useMemo(() => {
    if (!searchTerm.trim()) return DISCOURSE_TYPES;

    return DISCOURSE_TYPES.map((type) => ({
      ...type,
      items: type.items.filter((item) =>
        item.text.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    })).filter((type) => type.items.length > 0);
  }, [searchTerm]);

  const allItems = useMemo(() => {
    const items: {
      typeIndex: number;
      itemIndex: number;
      item: { id: string; text: string };
    }[] = [];

    filteredTypes.forEach((type, typeIndex) => {
      type.items.forEach((item, itemIndex) => {
        items.push({ typeIndex, itemIndex, item });
      });
    });

    return items;
  }, [filteredTypes]);

  const onSelect = useCallback(
    (item: { id: string; text: string }) => {
      waitForBlock(blockUid, textarea.value).then(() => {
        onClose();

        setTimeout(() => {
          const originalText = getTextByBlockUid(blockUid);

          const currentEnd =
            cursorPos !== -1
              ? cursorPos
              : triggerPosition + searchTerm.length + 1;

          const prefix = originalText.substring(0, triggerPosition);
          const suffix = originalText.substring(currentEnd);
          const pageRef = `[[${item.text}]]`;

          const newText = `${prefix}${pageRef}${suffix}`;
          updateBlock({ uid: blockUid, text: newText }).then(() => {
            const newCursorPosition = triggerPosition + pageRef.length;

            if (window.roamAlphaAPI.ui.setBlockFocusAndSelection) {
              window.roamAlphaAPI.ui.setBlockFocusAndSelection({
                location: {
                  "block-uid": blockUid,
                  "window-id": windowId,
                },
                selection: { start: newCursorPosition },
              });
            } else {
              setTimeout(() => {
                const textareaElements = document.querySelectorAll("textarea");
                for (const el of textareaElements) {
                  if (
                    getUids(el as HTMLTextAreaElement).blockUid === blockUid
                  ) {
                    (el as HTMLTextAreaElement).focus();
                    (el as HTMLTextAreaElement).setSelectionRange(
                      newCursorPosition,
                      newCursorPosition,
                    );
                    break;
                  }
                }
              }, 50);
            }
          });

          // Analytics
          posthog.capture("Discourse Node: Selected from Search Menu", {
            id: item.id,
            text: item.text,
          });
        }, 10);
      });
    },
    [blockUid, onClose, searchTerm, textarea],
  );

  const handleTextAreaInput = useCallback(() => {
    // Check if '@' and search term still exist in text before cursor
    const atTriggerRegex = /@(.*)$/;
    const textBeforeCursor = textarea.value.substring(
      triggerPosition,
      textarea.selectionStart,
    );
    console.log("textBeforeCursorrrrr", textBeforeCursor);
    const match = atTriggerRegex.exec(textBeforeCursor);
    console.log("matchhhh", match);
    if (match) {
      // @ trigger still exists, update the search term
      setSearchTerm(match[1]);
    } else {
      // @ trigger is gone or cursor moved before it, close the menu
      onClose();
      return;
    }
  }, [textarea, onClose, setSearchTerm, triggerPosition]);

  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        setActiveIndex((prev) => (prev + 1) % allItems.length);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "ArrowUp") {
        setActiveIndex(
          (prev) => (prev - 1 + allItems.length) % allItems.length,
        );
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key == "ArrowLeft" || e.key === "ArrowRight") {
        e.stopPropagation();
        e.preventDefault();
      } else if (e.key === "Enter") {
        if (allItems.length > 0) {
          e.preventDefault();
          e.stopPropagation();
          onSelect(allItems[activeIndex].item);
        }
      } else if (e.key === "Escape") {
        onClose();
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [
      allItems,
      setActiveIndex,
      onSelect,
      onClose,
      textarea,
      setSearchTerm,
      menuRef,
    ],
  );

  useEffect(() => {
    if (activeIndex >= allItems.length) {
      setActiveIndex(0);
    }
  }, [allItems, activeIndex]);

  useEffect(() => {
    document.addEventListener("keydown", keydownListener);
    return () => {
      document.removeEventListener("keydown", keydownListener);
    };
  }, [keydownListener]);

  useEffect(() => {
    textarea.addEventListener("input", handleTextAreaInput);
    return () => {
      textarea.removeEventListener("input", handleTextAreaInput);
    };
  }, [handleTextAreaInput, textarea]);

  useEffect(() => {
    const listeningEl = !!textarea.closest(".rm-reference-item")
      ? textarea.parentElement
      : textarea;
    listeningEl?.addEventListener("keydown", keydownListener);
    return () => {
      listeningEl?.removeEventListener("keydown", keydownListener);
    };
  }, [keydownListener]);

  useEffect(() => {
    handleTextAreaInput();
  }, [handleTextAreaInput]);

  let currentGlobalIndex = -1;

  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      target={<span />}
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: true },
        preventOverflow: { enabled: true },
      }}
      autoFocus={false}
      // enforceFocus={false}
      content={
        <div className="discourse-node-search-menu" style={{ width: "250px" }}>
          <div className="discourse-node-menu-content max-h-80 overflow-y-auto">
            {filteredTypes.map((type, typeIndex) => (
              <div key={type.type} className="mb-2">
                <div className="border-b border-gray-200 px-3 py-1 text-sm font-semibold text-gray-500">
                  {type.title}
                </div>
                <Menu ulRef={menuRef}>
                  {type.items.map((item, itemIndex) => {
                    currentGlobalIndex++;
                    const isActive = currentGlobalIndex === activeIndex;
                    return (
                      <MenuItem
                        key={item.id}
                        text={item.text}
                        active={isActive}
                        onMouseEnter={() => setActiveIndex(currentGlobalIndex)}
                        onClick={() => onSelect(item)}
                      />
                    );
                  })}
                </Menu>
              </div>
            ))}

            {allItems.length === 0 && (
              <div className="p-3 text-center text-gray-500">
                No matches found
              </div>
            )}
          </div>
        </div>
      }
    />
  );
};

export const renderDiscourseNodeSearchMenu = (props: Props) => {
  const parent = document.createElement("span");
  const coords = getCoordsFromTextarea(props.textarea);
  parent.style.position = "absolute";
  parent.style.left = `${coords.left}px`;
  parent.style.top = `${coords.top}px`;
  props.textarea.parentElement?.insertBefore(parent, props.textarea);

  ReactDOM.render(
    <NodeSearchMenu
      {...props}
      onClose={() => {
        props.onClose();
        ReactDOM.unmountComponentAtNode(parent);
        parent.remove();
      }}
    />,
    parent,
  );
};

export default NodeSearchMenu;
