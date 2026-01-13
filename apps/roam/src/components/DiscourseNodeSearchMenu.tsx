/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
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
  Intent,
} from "@blueprintjs/core";
import ReactDOM from "react-dom";
import getUids from "roamjs-components/dom/getUids";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import updateBlock from "roamjs-components/writes/updateBlock";
import posthog from "posthog-js";
import { getCoordsFromTextarea } from "roamjs-components/components/CursorMenu";
import { OnloadArgs } from "roamjs-components/types";
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseNodeFormatExpression from "~/utils/getDiscourseNodeFormatExpression";
import { Result } from "~/utils/types";
import { getSetting } from "~/utils/extensionSettings";
import MiniSearch from "minisearch";

type Props = {
  textarea: HTMLTextAreaElement;
  triggerPosition: number;
  onClose: () => void;
  triggerText: string;
};

type MinisearchResult = Result & {
  type: string;
};

const waitForBlock = ({
  uid,
  text,
  retries = 0,
  maxRetries = 30,
}: {
  uid: string;
  text: string;
  retries?: number;
  maxRetries?: number;
}): Promise<void> =>
  getTextByBlockUid(uid) === text
    ? Promise.resolve()
    : retries >= maxRetries
      ? Promise.resolve()
      : new Promise((resolve) =>
          setTimeout(
            () =>
              resolve(
                waitForBlock({
                  uid,
                  text,
                  retries: retries + 1,
                  maxRetries,
                }),
              ),
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
  const [discourseTypes, setDiscourseTypes] = useState<DiscourseNode[]>([]);
  const [checkedTypes, setCheckedTypes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchResults, setSearchResults] = useState<Record<string, Result[]>>(
    {},
  );
  const [isFilterMenuVisible, setIsFilterMenuVisible] = useState(false);
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
  const miniSearchRef = useRef<MiniSearch<MinisearchResult> | null>(null);
  const POPOVER_TOP_OFFSET = 30;

  const debouncedSearchTerm = useCallback((term: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setSearchTerm(term);
    }, 300);
  }, []);

  const searchNodesForType = (node: DiscourseNode): Result[] => {
    if (!node.format) return [];

    try {
      const regex = getDiscourseNodeFormatExpression(node.format);

      const regexPattern = regex.source
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');

      const query = `[
      :find
        (pull ?node [:block/string :node/title :block/uid])
      :where
        [(re-pattern "${regexPattern}") ?title-regex]
        [?node :node/title ?node-title]
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
      console.error(`Node format:`, node.format);
      return [];
    }
  };

  const searchWithMiniSearch = useCallback(
    (searchTerm: string, typeFilter?: string[]): Record<string, Result[]> => {
      const searchStartTime = performance.now();
      if (!miniSearchRef.current) {
        return {};
      }

      const search = miniSearchRef.current;

      // Early return for empty search - return all nodes for selected types
      if (!searchTerm.trim()) {
        const allDocuments = search.documentCount;
        const searchEndTime = performance.now();
        const searchDuration = searchEndTime - searchStartTime;

        console.log(
          `[MiniSearch] Empty search - ${allDocuments} total documents, ${searchDuration.toFixed(2)}ms`,
        );

        if (!typeFilter) {
          return {};
        }

        const allResults: Record<string, Result[]> = {};
        typeFilter.forEach((type) => {
          const results = (
            search.search(MiniSearch.wildcard, {
              filter: (result) =>
                (result as unknown as MinisearchResult).type === type,
            }) as unknown as MinisearchResult[]
          ).map((r) => ({
            text: r.text,
            uid: r.uid,
          }));
          allResults[type] = results;
        });

        return allResults;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const rawSearchResults = search.search(searchTerm, {
        fields: ["text"],
        fuzzy: 0.2,
        prefix: true,
        combineWith: "AND",
        filter: typeFilter
          ? (result) =>
              typeFilter.includes((result as unknown as MinisearchResult).type)
          : undefined,
      });

      const filteredResults = rawSearchResults.filter((r) => r.score > 0.1);

      const searchResults = (
        filteredResults as unknown as MinisearchResult[]
      ).map((r) => ({
        text: r.text,
        uid: r.uid,
        type: r.type,
      }));

      const results = searchResults.reduce(
        (acc, result) => {
          if (!acc[result.type]) {
            acc[result.type] = [];
          }
          acc[result.type].push({
            text: result.text,
            uid: result.uid,
          });
          return acc;
        },
        {} as Record<string, Result[]>,
      );

      const searchEndTime = performance.now();
      const searchDuration = searchEndTime - searchStartTime;
      const totalResults = searchResults.length;

      console.log(
        `[MiniSearch] Search "${searchTerm}" - ${totalResults} results in ${searchDuration.toFixed(2)}ms`,
      );

      return results;
    },
    [],
  );

  useEffect(() => {
    const fetchNodeTypes = () => {
      setIsLoading(true);
      const indexStartTime = performance.now();

      const allNodeTypes = getDiscourseNodes().filter(
        (n) => n.backedBy === "user",
      );

      setDiscourseTypes(allNodeTypes);

      const initialCheckedTypes: Record<string, boolean> = {};
      allNodeTypes.forEach((t) => {
        initialCheckedTypes[t.type] = true;
      });
      setCheckedTypes(initialCheckedTypes);

      const allNodesCache: Record<string, Result[]> = {};
      allNodeTypes.forEach((type) => {
        allNodesCache[type.type] = searchNodesForType(type);
      });

      const miniSearch = new MiniSearch<MinisearchResult>({
        fields: ["text"],
        storeFields: ["text", "uid", "type"],
        idField: "uid",
      });

      const documentsToIndex: MinisearchResult[] = [];
      let totalNodeCount = 0;

      allNodeTypes.forEach((type) => {
        const nodes = allNodesCache[type.type] || [];
        totalNodeCount += nodes.length;
        nodes.forEach((node) => {
          documentsToIndex.push({
            ...node,
            type: type.type,
          });
        });
      });

      const indexDocumentsStartTime = performance.now();
      miniSearch.addAll(documentsToIndex);
      const indexDocumentsEndTime = performance.now();
      const indexDuration = indexDocumentsEndTime - indexDocumentsStartTime;

      miniSearchRef.current = miniSearch;

      const indexEndTime = performance.now();
      const totalIndexDuration = indexEndTime - indexStartTime;

      console.log(
        `[MiniSearch] Indexed ${totalNodeCount} nodes across ${allNodeTypes.length} types - Indexing: ${indexDuration.toFixed(2)}ms, Total: ${totalIndexDuration.toFixed(2)}ms`,
      );

      const initialSearchResults = Object.fromEntries(
        allNodeTypes.map((type) => [type.type, []]),
      );
      setSearchResults(initialSearchResults);

      setIsLoading(false);
    };

    fetchNodeTypes();
  }, []);

  useEffect(() => {
    if (isLoading || !miniSearchRef.current) return;

    const selectedTypes = discourseTypes
      .filter((type) => checkedTypes[type.type])
      .map((type) => type.type);

    const newResults = searchWithMiniSearch(searchTerm, selectedTypes);
    setSearchResults(newResults);
  }, [
    searchTerm,
    isLoading,
    discourseTypes,
    checkedTypes,
    searchWithMiniSearch,
  ]);

  const menuRef = useRef<HTMLUListElement>(null);
  const { ["block-uid"]: blockUid, ["window-id"]: windowId } = useMemo(
    () =>
      window.roamAlphaAPI.ui.getFocusedBlock() || {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        "block-uid": "",
        // eslint-disable-next-line @typescript-eslint/naming-convention
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
      if (!blockUid) {
        onClose();
        return;
      }
      void waitForBlock({ uid: blockUid, text: textarea.value })
        .then(() => {
          onClose();

          setTimeout(() => {
            const originalText = getTextByBlockUid(blockUid);

            const prefix = originalText.substring(0, triggerPosition);
            const suffix = originalText.substring(textarea.selectionStart);
            const pageRef = `[[${item.text}]]`;

            const newText = `${prefix}${pageRef}${suffix}`;
            void updateBlock({ uid: blockUid, text: newText }).then(() => {
              const newCursorPosition = triggerPosition + pageRef.length;

              if (window.roamAlphaAPI.ui.setBlockFocusAndSelection) {
                void window.roamAlphaAPI.ui.setBlockFocusAndSelection({
                  location: {
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    "block-uid": blockUid,
                    // eslint-disable-next-line @typescript-eslint/naming-convention
                    "window-id": windowId,
                  },
                  selection: { start: newCursorPosition },
                });
              } else {
                setTimeout(() => {
                  const textareaElements =
                    document.querySelectorAll("textarea");
                  for (const el of textareaElements) {
                    if (getUids(el).blockUid === blockUid) {
                      el.focus();
                      el.setSelectionRange(
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
        })
        .catch((error) => {
          console.error("Error waiting for block:", error);
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

  const handleTypeCheckChange = useCallback((typeKey: string) => {
    setCheckedTypes((prev) => ({
      ...prev,
      [typeKey]: !prev[typeKey],
    }));
  }, []);

  const handleToggleAll = useCallback(
    (checked: boolean) => {
      setCheckedTypes(Object.fromEntries(typeIds.map((id) => [id, checked])));
    },
    [typeIds],
  );

  const handleSelectOnly = useCallback(
    (node: DiscourseNode) => {
      const next = Object.fromEntries(
        typeIds.map((id) => [id, id === node.type]),
      );
      setCheckedTypes(next as Record<string, boolean>);
    },
    [typeIds],
  );

  const renderTypeItem = useCallback(
    (item: DiscourseNode) => {
      const isSelected = !!checkedTypes[item.type];
      return (
        <MenuItem
          key={item.type}
          className="group !p-0"
          text={
            <div className="flex w-full items-center justify-between">
              <div className="flex flex-1 items-center px-2 py-1.5">
                <span className="mr-2">{isSelected ? "✓" : " "}</span>
                <span>{item.text}</span>
              </div>
              <Button
                minimal
                small
                className="flex !h-full items-center justify-center !rounded-none px-3 opacity-0 transition-opacity group-hover:opacity-100"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectOnly(item);
                  setIsFilterMenuVisible(false);
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                Only
              </Button>
            </div>
          }
          icon={null}
          shouldDismissPopover={false}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            handleTypeCheckChange(item.type);
          }}
          onMouseDown={(e) => e.preventDefault()}
        />
      );
    },
    [checkedTypes, handleTypeCheckChange, handleSelectOnly],
  );

  return (
    <Popover
      onClose={onClose}
      isOpen={true}
      canEscapeKeyClose
      minimal
      usePortal={true}
      target={<span />}
      position={Position.BOTTOM_LEFT}
      modifiers={{
        flip: { enabled: true },
        preventOverflow: { enabled: true, boundariesElement: "viewport" },
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
                  <Button
                    icon="filter"
                    minimal
                    small
                    title="Filter by type"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setIsFilterMenuVisible(!isFilterMenuVisible);
                    }}
                    onMouseDown={(e) => e.preventDefault()}
                  />
                </div>
                {isFilterMenuVisible && (
                  <div>
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-medium text-gray-700">
                        Filter by Type
                      </span>
                      <Button
                        small
                        intent={isAllSelected ? Intent.SUCCESS : Intent.PRIMARY}
                        icon={isAllSelected ? "tick" : "multi-select"}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleToggleAll(!isAllSelected);
                        }}
                      >
                        {isAllSelected ? "All selected" : "Select all"}
                      </Button>
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <Menu>
                        {discourseTypes.map((t) => renderTypeItem(t))}
                      </Menu>
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

  // eslint-disable-next-line react/no-deprecated
  ReactDOM.render(
    <NodeSearchMenu
      {...props}
      onClose={() => {
        props.onClose();
        // eslint-disable-next-line react/no-deprecated
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
    getSetting("node-search-trigger", "@"),
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
