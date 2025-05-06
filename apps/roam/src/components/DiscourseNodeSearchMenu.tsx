import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Menu, MenuItem, Popover, Position, Checkbox } from "@blueprintjs/core";
import ReactDOM from "react-dom";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import posthog from "posthog-js";
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
  const [checkedTypes, setCheckedTypes] = useState<Record<string, boolean>>(
    DISCOURSE_TYPES.reduce((acc, type) => ({ ...acc, [type.type]: true }), {}),
  );
  const menuRef = useRef<HTMLUListElement>(null);
  const { ["block-uid"]: blockUid, ["window-id"]: windowId } = useMemo(
    () =>
      window.roamAlphaAPI.ui.getFocusedBlock() || {
        "block-uid": "",
        "window-id": "",
      },
    [],
  );

  const filteredTypes = useMemo(() => {
    const typesToShow = DISCOURSE_TYPES.filter(
      (type) => checkedTypes[type.type],
    );

    if (!searchTerm.trim()) return typesToShow;

    return typesToShow
      .map((type) => ({
        ...type,
        items: type.items.filter((item) =>
          item.text.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      }))
      .filter((type) => type.items.length > 0);
  }, [searchTerm, checkedTypes]);

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

          const prefix = originalText.substring(0, triggerPosition);
          const suffix = originalText.substring(textarea.selectionStart);
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
    const atTriggerRegex = /@(.*)$/;
    const textBeforeCursor = textarea.value.substring(
      triggerPosition,
      textarea.selectionStart,
    );
    const match = atTriggerRegex.exec(textBeforeCursor);
    if (match) {
      setSearchTerm(match[1]);
    } else {
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
    setTimeout(() => {
      handleTextAreaInput();
    }, 50);
  }, [handleTextAreaInput]);

  let currentGlobalIndex = -1;

  const handleTypeCheckChange = useCallback(
    (typeKey: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setCheckedTypes((prev) => ({
        ...prev,
        [typeKey]: !prev[typeKey],
      }));

      setTimeout(() => {
        textarea.focus();
        const cursorPos = textarea.selectionStart;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    },
    [textarea],
  );

  const handleFilterSectionMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

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
      content={
        <div className="discourse-node-search-menu" style={{ width: "250px" }}>
          <div
            className="border-b border-gray-200 p-2"
            onMouseDown={handleFilterSectionMouseDown}
          >
            <div className="mb-2 text-sm font-semibold">Filter by type:</div>
            <div className="flex flex-wrap gap-2">
              {DISCOURSE_TYPES.map((type) => (
                <div
                  key={type.type}
                  className="inline-flex cursor-pointer items-center"
                  onClick={(e) => handleTypeCheckChange(type.type, e)}
                >
                  <Checkbox
                    label={type.title}
                    checked={checkedTypes[type.type]}
                    onChange={() => {}}
                    className="m-0"
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="discourse-node-menu-content h-64 overflow-y-auto">
            {filteredTypes.map((type, typeIndex) => (
              <div key={type.type} className="mb-2">
                <div className="border-b border-gray-200 px-3 py-1 text-sm font-semibold text-gray-500">
                  {type.title}
                </div>
                <Menu ulRef={menuRef}>
                  {type.items.map((item) => {
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
