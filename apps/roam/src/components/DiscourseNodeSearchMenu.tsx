import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Menu,
  MenuItem,
  Popover,
  Position,
  Checkbox,
  Button,
  InputGroup,
  IKeyCombo,
  getKeyCombo,
} from "@blueprintjs/core";
import ReactDOM from "react-dom";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import posthog from "posthog-js";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import { escapeCljString } from "~/utils/formatUtils";
import { Result } from "~/utils/types";
import { OnloadArgs } from "roamjs-components/types";
import { getModifiersFromCombo, normalizeKeyCombo } from "./DiscourseNodeMenu";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerPosition: number;
  onClose: () => void;
  extensionAPI: OnloadArgs["extensionAPI"];
};

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
  extensionAPI,
}: { onClose: () => void } & Props) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [discourseTypes, setDiscourseTypes] = useState<DiscourseNode[]>([]);
  const [checkedTypes, setCheckedTypes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Record<string, Result[]>>(
    {},
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedSearchTerm = useCallback((term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(term);
    }, 300);
  }, []);

  const searchNodesForType = (
    node: DiscourseNode,
    searchTerm: string,
  ): Result[] => {
    if (!node.format) return [];

    try {
      const regex = getDiscourseNodeFormatExpression(node.format);

      const regexPattern = regex.source
        .replace(/^\^/, "")
        .replace(/\$$/, "")
        .replace(/\\/g, "\\\\");

      const query = `[
      :find
        (pull ?node [:block/string :node/title :block/uid])
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
        ${searchTerm ? `[(clojure.string/includes? ?node-title "${escapeCljString(searchTerm)}")]` : ""}
        [(re-find ?title-regex ?node-title)]
    ]`;
      const results = window.roamAlphaAPI.q(query);

      return results.map(([result]: any) => ({
        id: result.uid,
        text: result.title || result.string,
        uid: result.uid,
      }));
    } catch (error) {
      console.error(`Error querying for node type ${node.type}:`, error);
      return [];
    }
  };

  useEffect(() => {
    const fetchNodeTypes = async () => {
      setIsLoading(true);

      const allNodeTypes = getDiscourseNodes().filter(
        (n) => n.backedBy === "user",
      );

      setDiscourseTypes(allNodeTypes);

      const initialCheckedTypes: Record<string, boolean> = {};
      allNodeTypes.forEach((t) => {
        initialCheckedTypes[t.type] = true;
      });
      setCheckedTypes(initialCheckedTypes);

      const initialSearchResults = allNodeTypes.reduce(
        (acc, type) => ({ ...acc, [type.type]: [] }),
        {},
      );
      setSearchResults(initialSearchResults);

      setIsLoading(false);
    };

    fetchNodeTypes();
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const newResults: Record<string, Result[]> = {};

    discourseTypes.forEach((type) => {
      newResults[type.type] = searchNodesForType(type, searchTerm);
    });

    setSearchResults(newResults);
  }, [searchTerm, isLoading, discourseTypes]);

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
    return discourseTypes
      .filter((type) => checkedTypes[type.type])
      .filter((type) => searchResults[type.type]?.length > 0);
  }, [discourseTypes, checkedTypes, searchResults]);

  const allItems = useMemo(() => {
    const items: {
      typeIndex: number;
      itemIndex: number;
      item: Result;
    }[] = [];

    filteredTypes.forEach((type, typeIndex) => {
      const typeResults = searchResults[type.type] || [];
      typeResults.forEach((item, itemIndex) => {
        items.push({ typeIndex, itemIndex, item });
      });
    });

    return items;
  }, [filteredTypes, searchResults]);

  const onSelect = useCallback(
    (item: Result) => {
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
          posthog.capture("Discourse Node: Selected from Search Menu", {
            id: item.id,
            text: item.text,
          });
        }, 10);
      });
    },
    [blockUid, onClose, textarea, triggerPosition, windowId],
  );

  const handleTextAreaInput = useCallback(() => {
    const textAfterTrigger = textarea.value.substring(
      triggerPosition,
      textarea.selectionStart,
    );

    if (textAfterTrigger.length > 0) {
      debouncedSearchTerm(textAfterTrigger);
    }
  }, [textarea, debouncedSearchTerm, triggerPosition]);

  const keydownListener = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" && allItems.length) {
        setActiveIndex((prev) => (prev + 1) % allItems.length);
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key === "ArrowUp" && allItems.length) {
        setActiveIndex(
          (prev) => (prev - 1 + allItems.length) % allItems.length,
        );
        e.preventDefault();
        e.stopPropagation();
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
    [allItems, setActiveIndex, onSelect, onClose],
  );

  useEffect(() => {
    if (activeIndex >= allItems.length) {
      setActiveIndex(0);
    }
  }, [allItems, activeIndex]);

  useEffect(() => {
    textarea.addEventListener("input", handleTextAreaInput);
    return () => {
      textarea.removeEventListener("input", handleTextAreaInput);
    };
  }, [handleTextAreaInput, textarea]);

  useEffect(() => {
    const listeningEl = textarea.closest(".rm-reference-item")
      ? textarea.parentElement
      : textarea;

    if (listeningEl) {
      listeningEl.addEventListener("keydown", keydownListener);
      listeningEl.addEventListener("input", handleTextAreaInput);
    }

    return () => {
      if (listeningEl) {
        listeningEl.removeEventListener("keydown", keydownListener);
        listeningEl.removeEventListener("input", handleTextAreaInput);
      }
    };
  }, [textarea, keydownListener, handleTextAreaInput]);

  useEffect(() => {
    setTimeout(() => {
      handleTextAreaInput();
    }, 50);
  }, [handleTextAreaInput]);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (scrollContainerRef.current) {
      const activeItem = scrollContainerRef.current.querySelector(
        '[data-active="true"]',
      ) as HTMLElement;

      if (activeItem) {
        const container = scrollContainerRef.current;
        const containerRect = container.getBoundingClientRect();
        const itemRect = activeItem.getBoundingClientRect();

        if (
          itemRect.bottom > containerRect.bottom ||
          itemRect.top < containerRect.top
        ) {
          activeItem.scrollIntoView({
            block: "nearest",
            behavior: "auto",
          });
        }
      }
    }
  }, [activeIndex]);

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

  const remainFocusOnTextarea = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const toggleFilterMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsFilterMenuOpen((prev) => !prev);

      // Restore focus after toggle
      setTimeout(() => {
        if (textarea) {
          textarea.focus();
          const cursorPos = textarea.selectionStart;
          textarea.setSelectionRange(cursorPos, cursorPos);
        }
      }, 0);
    },
    [textarea],
  );

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
        <div
          className="discourse-node-search-menu"
          style={{ width: "250px" }}
          onMouseDown={remainFocusOnTextarea}
          onClick={remainFocusOnTextarea}
        >
          {isLoading ? (
            <div className="p-3 text-center text-gray-500">Loading...</div>
          ) : (
            <>
              <div
                className="discourse-node-search-menu"
                style={{ width: "250px" }}
                onMouseDown={remainFocusOnTextarea}
                onClick={remainFocusOnTextarea}
              >
                <div className="flex items-center justify-between border-b border-gray-200 p-2">
                  <div className="text-sm font-semibold">Search Results</div>
                  <Button
                    icon="filter"
                    minimal
                    small
                    active={isFilterMenuOpen}
                    onClick={toggleFilterMenu}
                    onMouseDown={remainFocusOnTextarea}
                    title="Filter by type"
                  />
                </div>

                {isFilterMenuOpen && (
                  <div className="border-b border-gray-200 p-2">
                    <div className="mb-2 text-sm font-semibold">
                      Filter by type:
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {discourseTypes.map((type) => (
                        <div
                          key={type.type}
                          className="inline-flex cursor-pointer items-center"
                          onClick={(e) => handleTypeCheckChange(type.type, e)}
                        >
                          <Checkbox
                            label={type.text}
                            checked={checkedTypes[type.type]}
                            onChange={() => {}}
                            className="m-0"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="h-64 overflow-y-auto" ref={scrollContainerRef}>
                {filteredTypes.map((type) => (
                  <div key={type.type} className="mb-2">
                    <div className="border-b border-gray-200 px-3 py-1 text-sm font-semibold text-gray-500">
                      {type.text}
                    </div>
                    <Menu ulRef={menuRef}>
                      {searchResults[type.type]?.map((item) => {
                        currentGlobalIndex++;
                        const isActive = currentGlobalIndex === activeIndex;
                        return (
                          <MenuItem
                            key={item.uid}
                            text={item.text}
                            data-active={isActive}
                            active={isActive}
                            onMouseEnter={() =>
                              setActiveIndex(currentGlobalIndex)
                            }
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
            </>
          )}
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

export const NodeSearchMenuTriggerComponent = ({
  extensionAPI,
}: {
  extensionAPI: OnloadArgs["extensionAPI"];
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [comboKey, setComboKey] = useState<IKeyCombo>(
    () =>
      (extensionAPI.settings.get(
        "discourse-node-search-trigger",
      ) as IKeyCombo) || { modifiers: 0, key: "@" },
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const comboObj = getKeyCombo(e.nativeEvent);
      if (!comboObj.key) return;
      const specialCharMap = {
        // Numbers row
        "~": { key: "`", modifiers: 8 },
        "!": { key: "1", modifiers: 8 },
        "@": { key: "2", modifiers: 8 },
        "#": { key: "3", modifiers: 8 },
        $: { key: "4", modifiers: 8 },
        "%": { key: "5", modifiers: 8 },
        "^": { key: "6", modifiers: 8 },
        "&": { key: "7", modifiers: 8 },
        "*": { key: "8", modifiers: 8 },
        "(": { key: "9", modifiers: 8 },
        ")": { key: "0", modifiers: 8 },
        _: { key: "-", modifiers: 8 },
        "+": { key: "=", modifiers: 8 },

        // Brackets and punctuation
        "{": { key: "[", modifiers: 8 },
        "}": { key: "]", modifiers: 8 },
        "|": { key: "\\", modifiers: 8 },
        ":": { key: ";", modifiers: 8 },
        '"': { key: "'", modifiers: 8 },
        "<": { key: ",", modifiers: 8 },
        ">": { key: ".", modifiers: 8 },
        "?": { key: "/", modifiers: 8 },
      };

      for (const [specialChar, mapping] of Object.entries(specialCharMap)) {
        if (
          comboObj.key === mapping.key &&
          comboObj.modifiers === mapping.modifiers
        ) {
          setComboKey({ modifiers: 0, key: specialChar });
          extensionAPI.settings.set("discourse-node-search-trigger", {
            modifiers: 0,
            key: specialChar,
          });
          return;
        }
      }

      setComboKey(comboObj);
      extensionAPI.settings.set("discourse-node-search-trigger", comboObj);
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
      placeholder={
        isActive ? "Press keys ..." : "Click to set trigger (default: @)"
      }
      value={shortcut}
      onKeyDown={handleKeyDown}
      onFocus={() => setIsActive(true)}
      onBlur={() => setIsActive(false)}
      rightElement={
        <Button
          hidden={
            !comboKey.key || (comboKey.key === "@" && comboKey.modifiers === 0)
          }
          icon={"remove"}
          onClick={() => {
            setComboKey({ modifiers: 0, key: "@" });
            extensionAPI.settings.set("discourse-node-search-trigger", {
              modifiers: 0,
              key: "@",
            });
          }}
          minimal
        />
      }
    />
  );
};

export default NodeSearchMenu;
