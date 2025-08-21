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
  Button,
  InputGroup,
} from "@blueprintjs/core";
import { MultiSelect, ItemRenderer, ItemPredicate } from "@blueprintjs/select";
import ReactDOM from "react-dom";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import posthog from "posthog-js";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import { escapeCljString } from "~/utils/formatUtils";
import { Result } from "~/utils/types";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerPosition: number;
  onClose: () => void;
  triggerText: string;
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
  triggerText,
}: { onClose: () => void } & Props) => {
  const MENU_WIDTH = 400;
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(true);
  const [discourseTypes, setDiscourseTypes] = useState<DiscourseNode[]>([]);
  const [checkedTypes, setCheckedTypes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Record<string, Result[]>>(
    {},
  );
  const typeIds = useMemo(
    () => discourseTypes.map((t) => t.type),
    [discourseTypes],
  );
  const isAllSelected = useMemo(
    () => typeIds.length > 0 && typeIds.every((id) => !!checkedTypes[id]),
    [typeIds, checkedTypes],
  );
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const POPOVER_TOP_OFFSET = 30;

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
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');

      const searchCondition = searchTerm
        ? `[(re-pattern "(?i).*${escapeCljString(searchTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))}.*") ?search-regex]
           [(re-find ?search-regex ?node-title)]`
        : "";

      const query = `[
      :find
        (pull ?node [:block/string :node/title :block/uid])
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
        [(re-find ?title-regex ?node-title)]
        ${searchCondition}
    ]`;
      const results = window.roamAlphaAPI.q(query);

      return results.map(([result]: any) => ({
        id: result.uid,
        text: result.title || result.string,
        uid: result.uid,
      }));
    } catch (error) {
      console.error(`Error querying for node type ${node.type}:`, error);
      console.error(`Node format:`, node.format);
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

      const initialSearchResults = Object.fromEntries(
        allNodeTypes.map((type) => [type.type, []]),
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

  const selectedTypes = useMemo(
    () => discourseTypes.filter((t) => checkedTypes[t.type]),
    [discourseTypes, checkedTypes],
  );

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
    const triggerRegex = new RegExp(
      `${triggerText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(.*)$`,
    );
    const textBeforeCursor = textarea.value.substring(
      triggerPosition,
      textarea.selectionStart,
    );
    const match = triggerRegex.exec(textBeforeCursor);
    if (match) {
      debouncedSearchTerm(match[1]);
    } else {
      onClose();
      return;
    }
  }, [textarea, onClose, debouncedSearchTerm, triggerPosition, triggerText]);

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
    [allItems, activeIndex, setActiveIndex, onSelect, onClose],
  );

  useEffect(() => {
    if (activeIndex >= allItems.length) {
      setActiveIndex(0);
    }
  }, [allItems, activeIndex]);

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

  const refocusTextarea = useCallback(() => {
    setTimeout(() => {
      console.log("refocusing textarea", Date.now());
      if (!textarea) return;
      textarea.focus();
      const cursorPos = textarea.selectionStart;
      console.log("cursorPos", cursorPos);
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  }, [textarea]);

  const handleTypeCheckChange = useCallback(
    (typeKey: string) => {
      setCheckedTypes((prev) => ({
        ...prev,
        [typeKey]: !prev[typeKey],
      }));

      refocusTextarea();
    },
    [refocusTextarea],
  );

  const remainFocusOnTextarea = useCallback(
    (e: React.MouseEvent) => {
      // Prevent default to avoid moving focus away from the textarea
      e.preventDefault();
      setTimeout(() => refocusTextarea(), 0);
    },
    [refocusTextarea],
  );

  const toggleFilterMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsFilterMenuOpen((prev) => !prev);

      refocusTextarea();
    },
    [refocusTextarea],
  );

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      setCheckedTypes(Object.fromEntries(typeIds.map((id) => [id, checked])));
      refocusTextarea();
    },
    [typeIds, refocusTextarea],
  );

  const handleSelectOnly = useCallback(
    (node: DiscourseNode) => {
      const next = Object.fromEntries(
        typeIds.map((id) => [id, id === node.type]),
      );
      setCheckedTypes(next as Record<string, boolean>);
      refocusTextarea();
    },
    [typeIds, refocusTextarea],
  );

  const renderType: ItemRenderer<DiscourseNode> = (
    item,
    { modifiers, handleClick },
  ) => {
    if (!modifiers.matchesPredicate) return null;
    const isSelected = !!checkedTypes[item.type];
    return (
      <MenuItem
        key={item.type}
        className="group"
        text={item.text}
        icon={isSelected ? "tick" : "blank"}
        active={modifiers.active}
        shouldDismissPopover={false}
        onClick={(e) => handleClick(e)}
        onMouseDown={(e) => e.preventDefault()}
        labelElement={
          <Button
            minimal
            small
            className="opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectOnly(item);
            }}
          >
            Only
          </Button>
        }
      />
    );
  };

  const filterType: ItemPredicate<DiscourseNode> = (query, item) => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return true;
    return (
      item.text.toLowerCase().includes(q) || item.type.toLowerCase().includes(q)
    );
  };

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
        offset: {
          enabled: true,
          fn: (data) => {
            if (data.placement?.startsWith("top") && data.offsets?.popper) {
              data.offsets.popper.top -= POPOVER_TOP_OFFSET;
            }
            return data;
          },
        },
      }}
      autoFocus={false}
      content={
        <div
          className="discourse-node-search-menu"
          style={{ width: MENU_WIDTH }}
        >
          {isLoading ? (
            <div className="p-3 text-center text-gray-500">Loading...</div>
          ) : (
            <>
              <div
                className="discourse-node-search-menu"
                style={{ width: MENU_WIDTH }}
              >
                <div className="flex items-center justify-between border-b border-gray-200 p-2">
                  <div className="text-sm font-semibold">Search Results</div>
                  <Button
                    icon="filter"
                    minimal
                    small
                    active={isFilterMenuOpen}
                    onClick={toggleFilterMenu}
                    title="Filter by type"
                  />
                </div>

                {isFilterMenuOpen && (
                  <div className="border-b border-gray-200 p-2">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <div>Filter by type:</div>
                      <div className="flex items-center gap-2">
                        <Button
                          small
                          minimal
                          icon={isAllSelected ? "tick" : undefined}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleToggleAll(!isAllSelected)}
                        >
                          Select all
                        </Button>
                      </div>
                    </div>

                    <MultiSelect<DiscourseNode>
                      items={discourseTypes}
                      itemRenderer={renderType}
                      itemPredicate={filterType}
                      onItemSelect={(item: DiscourseNode) =>
                        handleTypeCheckChange(item.type)
                      }
                      selectedItems={selectedTypes}
                      tagRenderer={(item: DiscourseNode) => item.text}
                      tagInputProps={{
                        onRemove: (_tag, index) => {
                          const removed = selectedTypes[index];
                          if (removed) handleTypeCheckChange(removed.type);
                        },
                      }}
                      placeholder="Select types..."
                      popoverProps={{
                        minimal: true,
                        enforceFocus: false,
                        autoFocus: false,
                        usePortal: true,
                        onOpening: () => setTimeout(() => {}, 0),
                      }}
                      resetOnSelect={false}
                      fill
                    />
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
                            multiline
                            data-active={isActive}
                            active={isActive}
                            shouldDismissPopover={false}
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

export const NodeSearchMenuTriggerSetting = ({
  onloadArgs,
}: {
  onloadArgs: OnloadArgs;
}) => {
  const extensionAPI = onloadArgs.extensionAPI;
  const [nodeSearchTrigger, setNodeSearchTrigger] = useState<string>(
    extensionAPI.settings.get("node-search-trigger") as string,
  );

  const handleNodeSearchTriggerChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = e.target.value.trim();
    const trigger = value
      .replace(/"/g, "")
      .replace(/\\/g, "\\\\")
      .replace(/\+/g, "\\+")
      .trim();

    setNodeSearchTrigger(trigger);
    extensionAPI.settings.set("node-search-trigger", trigger);
  };
  return (
    <InputGroup
      value={nodeSearchTrigger}
      onChange={handleNodeSearchTriggerChange}
      placeholder="Click to set trigger"
      maxLength={5}
    />
  );
};

export default NodeSearchMenu;
