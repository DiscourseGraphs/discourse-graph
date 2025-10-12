import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  Button,
  ControlGroup,
  Intent,
  Menu,
  MenuItem,
  Position,
  Popover,
  Spinner,
  Tag,
  Label,
} from "@blueprintjs/core";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import { Result } from "roamjs-components/types/query-builder";
import { performHydeSearch } from "../utils/hyde";
import { createBlock } from "roamjs-components/writes";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import findDiscourseNode from "~/utils/findDiscourseNode";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import { type RelationDetails } from "~/utils/hyde";
import { getFormattedConfigTree } from "~/utils/discourseConfigRef";

export type DiscourseData = {
  results: Awaited<ReturnType<typeof getDiscourseContextResults>>;
  refs: number;
};

const cache: {
  [tag: string]: DiscourseData;
} = {};

const getOverlayInfo = async (
  tag: string,
  relations: ReturnType<typeof getDiscourseRelations>,
): Promise<DiscourseData> => {
  try {
    if (cache[tag]) return cache[tag];

    const nodes = getDiscourseNodes(relations);

    const [results, refs] = await Promise.all([
      getDiscourseContextResults({
        uid: getPageUidByPageTitle(tag),
        nodes,
        relations,
      }),
      // @ts-ignore - backend to be added to roamjs-components
      window.roamAlphaAPI.data.backend.q(
        `[:find ?a :where [?b :node/title "${normalizePageTitle(tag)}"] [?a :block/refs ?b]]`,
      ),
    ]);

    return (cache[tag] = {
      results,
      refs: refs.length,
    });
  } catch (error) {
    console.error(`Error getting overlay info for ${tag}:`, error);
    return {
      results: [],
      refs: 0,
    };
  }
};

type DiscourseRelation = ReturnType<typeof getDiscourseRelations>[number];
type DiscourseNode = ReturnType<typeof getDiscourseNodes>[number];

const getRelationsForNodeType = (
  relations: DiscourseRelation[],
  nodeType: string,
): DiscourseRelation[] => {
  return relations.filter(
    (relation) =>
      relation.source === nodeType || relation.destination === nodeType,
  );
};

const buildRelationTriplet = (
  relation: DiscourseRelation,
  targetNode: DiscourseNode,
  isSourceRelation: boolean,
): { key: string; details: RelationDetails } => {
  const label = isSourceRelation ? relation.label : relation.complement;
  return {
    key: `${label}-${targetNode.text}`,
    details: {
      relationLabel: label,
      relatedNodeText: targetNode.text,
      relatedNodeFormat: targetNode.format,
    },
  };
};

const getUniqueRelationTriplets = (
  relations: DiscourseRelation[],
  nodeType: string,
  allNodes: DiscourseNode[],
): RelationDetails[] => {
  const triplets = new Map<string, RelationDetails>();

  relations.forEach((relation) => {
    const isSource = relation.source === nodeType;
    const isDestination = relation.destination === nodeType;

    if (isSource) {
      const targetNode = allNodes.find((n) => n.type === relation.destination);
      if (targetNode) {
        const { key, details } = buildRelationTriplet(
          relation,
          targetNode,
          true,
        );
        triplets.set(key, details);
      }
    }

    if (isDestination) {
      const targetNode = allNodes.find((n) => n.type === relation.source);
      if (targetNode) {
        const { key, details } = buildRelationTriplet(
          relation,
          targetNode,
          false,
        );
        triplets.set(key, details);
      }
    }
  });

  return Array.from(triplets.values());
};

const hasSelfReferentialRelation = (
  relations: DiscourseRelation[],
  nodeType: string,
): boolean => {
  return relations.some(
    (relation) =>
      relation.source === nodeType && relation.destination === nodeType,
  );
};

const getValidNodeTypes = (
  relations: DiscourseRelation[],
  nodeType: string,
): string[] => {
  const allTypes = Array.from(
    new Set(
      relations.flatMap((relation) => [relation.source, relation.destination]),
    ),
  );

  const includesSelfRelation = hasSelfReferentialRelation(relations, nodeType);
  return includesSelfRelation
    ? allTypes
    : allTypes.filter((type) => type !== nodeType);
};

const MAX_CACHE_SIZE = 50;

type SuggestedNode = Result & { type: string };
type SuggestionsCache = {
  selectedPages: string[];
  useAllPagesForSuggestions: boolean;
  hydeFilteredNodes: SuggestedNode[];
  activeNodeTypeFilters: string[];
};
const suggestionsCache = new Map<string, SuggestionsCache>();

const moveCacheEntryToEnd = (blockUid: string): void => {
  const data = suggestionsCache.get(blockUid);
  if (!data) return;
  suggestionsCache.delete(blockUid);
  suggestionsCache.set(blockUid, data);
};

const evictOldestCacheEntryIfNeeded = (blockUid: string): void => {
  const firstKey = suggestionsCache.keys().next().value as string | undefined;
  if (
    !suggestionsCache.has(blockUid) &&
    suggestionsCache.size >= MAX_CACHE_SIZE &&
    firstKey
  ) {
    suggestionsCache.delete(firstKey);
  }
};

const updateSuggestionsCache = (
  blockUid: string,
  cacheData: SuggestionsCache,
): void => {
  evictOldestCacheEntryIfNeeded(blockUid);
  suggestionsCache.set(blockUid, cacheData);
};

const SuggestionsBody = ({
  tag,
  blockUid,
}: {
  tag: string;
  blockUid: string;
}) => {
  const allPages = useMemo(() => getAllPageNames(), []);
  const cachedState = suggestionsCache.get(blockUid);

  const [existingResults, setExistingResults] = useState<
    DiscourseData["results"]
  >([]);

  const tagUid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const discourseNode = useMemo(() => findDiscourseNode(tagUid), [tagUid]);
  const allRelations = useMemo(() => getDiscourseRelations(), []);
  const allNodes = useMemo(() => getDiscourseNodes(), []);

  const validRelations = useMemo(() => {
    if (!discourseNode) return [];
    return getRelationsForNodeType(allRelations, discourseNode.type);
  }, [allRelations, discourseNode]);

  const uniqueRelationTypeTriplets = useMemo(() => {
    if (!discourseNode) return [];
    return getUniqueRelationTriplets(
      validRelations,
      discourseNode.type,
      allNodes,
    );
  }, [validRelations, discourseNode, allNodes]);

  const validTypes = useMemo(() => {
    if (!discourseNode) return [];
    return getValidNodeTypes(validRelations, discourseNode.type);
  }, [discourseNode, validRelations]);

  const fetchExistingResults = useCallback(() => {
    return getOverlayInfo(tag, allRelations)
      .then(({ results }) => {
        setExistingResults(results);
      })
      .catch(console.error);
  }, [tag, allRelations]);

  useEffect(() => {
    void fetchExistingResults();
  }, [fetchExistingResults]);

  const [currentPageInput, setCurrentPageInput] = useState("");
  const [selectedPages, setSelectedPages] = useState<string[]>(
    cachedState?.selectedPages || [],
  );
  const [useAllPagesForSuggestions, setUseAllPagesForSuggestions] = useState(
    cachedState?.useAllPagesForSuggestions || false,
  );
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [pageGroups, setPageGroups] = useState<Record<string, string[]>>({});
  const [hydeFilteredNodes, setHydeFilteredNodes] = useState<SuggestedNode[]>(
    cachedState?.hydeFilteredNodes || [],
  );
  const [activeNodeTypeFilters, setActiveNodeTypeFilters] = useState<string[]>(
    cachedState?.activeNodeTypeFilters || [],
  );
  const [isSearchingHyde, setIsSearchingHyde] = useState(false);
  const [hasPerformedSearch, setHasPerformedSearch] = useState(
    (cachedState?.hydeFilteredNodes?.length ?? 0) > 0,
  );

  const actuallyDisplayedNodes = useMemo(() => {
    if (activeNodeTypeFilters.length === 0) return hydeFilteredNodes;
    return hydeFilteredNodes.filter((n) =>
      activeNodeTypeFilters.includes(n.type),
    );
  }, [hydeFilteredNodes, activeNodeTypeFilters]);

  const uniqueSuggestedTypeUIDs = useMemo(
    () => Array.from(new Set(hydeFilteredNodes.map((n) => n.type))),
    [hydeFilteredNodes],
  );

  const availableFilterTypes = useMemo(() => {
    return uniqueSuggestedTypeUIDs
      .map((uid) => {
        const nodeDef = allNodes.find((n) => n.type === uid);
        return { uid, text: nodeDef ? nodeDef.text : uid };
      })
      .sort((a, b) => a.text.localeCompare(b.text));
  }, [uniqueSuggestedTypeUIDs, allNodes]);

  const handleAddPage = () => {
    if (currentPageInput && !selectedPages.includes(currentPageInput)) {
      setSelectedPages((prev) => [...prev, currentPageInput]);
      setTimeout(() => {
        setCurrentPageInput("");
        setAutocompleteKey((prev) => prev + 1);
      }, 0);
      setUseAllPagesForSuggestions(false);
    }
  };

  const handleCreateBlock = async (node: SuggestedNode) => {
    await createBlock({
      parentUid: blockUid,
      node: { text: `[[${node.text}]]` },
    });
    setHydeFilteredNodes((prev) => prev.filter((n) => n.uid !== node.uid));
  };

  const toggleOverlayHighlight = (nodeUid: string, on: boolean) => {
    document
      .querySelectorAll(`[suggestive-mode-overlay-button-uid="${nodeUid}"]`)
      .forEach((el) =>
        el.classList.toggle(
          "suggestive-mode-overlay-highlight-on-panel-hover",
          on,
        ),
      );
  };

  const executeHydeSearch = async (
    useAllPages: boolean,
    pages: string[],
  ): Promise<void> => {
    setIsSearchingHyde(true);
    try {
      const results = await performHydeSearch({
        useAllPagesForSuggestions: useAllPages,
        selectedPages: pages,
        discourseNode,
        blockUid,
        validTypes,
        existingResults,
        uniqueRelationTypeTriplets,
        pageTitle: tag,
      });
      setHydeFilteredNodes(results);
    } catch (error) {
      console.error("Hyde search failed:", error);
      setHasPerformedSearch(true);
    } finally {
      setHasPerformedSearch(true);
      setIsSearchingHyde(false);
    }
  };

  useEffect(() => {
    const config = getFormattedConfigTree();
    const groups = config.suggestiveMode.pageGroups.groups;

    const groupsRecord = groups.reduce(
      (acc, group) => {
        acc[group.name] = group.pages.map((p) => p.name);
        return acc;
      },
      {} as Record<string, string[]>,
    );

    setPageGroups(groupsRecord);
  }, []);

  useEffect(() => {
    moveCacheEntryToEnd(blockUid);
  }, [blockUid]);

  useEffect(() => {
    updateSuggestionsCache(blockUid, {
      selectedPages,
      useAllPagesForSuggestions,
      hydeFilteredNodes,
      activeNodeTypeFilters,
    });
  }, [
    blockUid,
    selectedPages,
    useAllPagesForSuggestions,
    hydeFilteredNodes,
    activeNodeTypeFilters,
  ]);

  return (
    <div onMouseDown={(e) => e.stopPropagation()}>
      <div className="mt-2">
        <Label>Suggest relationships from pages</Label>
        <ControlGroup fill className="flex flex-wrap items-center gap-2">
          <div className="flex flex-shrink-0 items-center gap-2">
            <div
              onKeyDown={(e) => {
                if (e.key === "Enter" && currentPageInput) {
                  e.preventDefault();
                  e.stopPropagation();
                  handleAddPage();
                }
              }}
            >
              <AutocompleteInput
                key={autocompleteKey}
                value={currentPageInput}
                placeholder={"Add page…"}
                setValue={setCurrentPageInput}
                options={allPages}
                maxItemsDisplayed={50}
              />
            </div>

            <Button
              icon="plus"
              small
              onClick={handleAddPage}
              disabled={
                !currentPageInput || selectedPages.includes(currentPageInput)
              }
            />

            {Object.keys(pageGroups).length > 0 && (
              <Popover
                position={Position.BOTTOM_LEFT}
                content={
                  <Menu>
                    {Object.keys(pageGroups)
                      .sort((a, b) => a.localeCompare(b))
                      .map((groupName) => (
                        <MenuItem
                          key={groupName}
                          text={groupName}
                          onClick={() => {
                            const groupPages = pageGroups[groupName] || [];
                            setSelectedPages((prev) =>
                              Array.from(new Set([...prev, ...groupPages])),
                            );
                            setUseAllPagesForSuggestions(false);
                          }}
                        />
                      ))}
                  </Menu>
                }
              >
                <Button icon="folder-open" small text="Add Group" />
              </Popover>
            )}
          </div>
          <div className="flex-grow" />
          <Button
            text="Find"
            icon="search-template"
            intent={Intent.PRIMARY}
            onClick={() => {
              setUseAllPagesForSuggestions(false);
              void executeHydeSearch(false, [...selectedPages]);
            }}
            disabled={selectedPages.length === 0}
            small
          />
          <Button
            text="All Pages"
            icon="globe-network"
            small
            onClick={() => {
              setUseAllPagesForSuggestions(true);
              setSelectedPages([]);
              setCurrentPageInput("");
              setAutocompleteKey((prev) => prev + 1);
              void executeHydeSearch(true, []);
            }}
          />
        </ControlGroup>
        {selectedPages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedPages.map((p) => (
              <Tag
                key={p}
                onRemove={() => {
                  setSelectedPages((prev) => prev.filter((x) => x !== p));
                }}
                round
                minimal
              >
                {p}
              </Tag>
            ))}
          </div>
        )}
      </div>

      {(hydeFilteredNodes.length > 0 ||
        isSearchingHyde ||
        hasPerformedSearch) && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between px-1.5 py-1.5 pr-4">
            <h3 className="m-0 text-base font-semibold">
              {useAllPagesForSuggestions
                ? "From All Pages"
                : selectedPages.length > 0
                  ? `From ${selectedPages.length === 1 ? `"${selectedPages[0]}"` : `${selectedPages.length} selected pages`}`
                  : "Select pages to see suggestions"}
            </h3>
            {actuallyDisplayedNodes.length > 0 && (
              <span className="ml-2 text-sm font-semibold text-gray-900">
                Total nodes: {actuallyDisplayedNodes.length}
              </span>
            )}
            {availableFilterTypes.length > 0 && (
              <Popover
                position={Position.BOTTOM_RIGHT}
                content={
                  <div className="space-y-1 p-2">
                    {availableFilterTypes.map((t) => (
                      <Button
                        key={t.uid}
                        small
                        minimal
                        fill
                        alignText="left"
                        text={t.text}
                        intent={
                          activeNodeTypeFilters.includes(t.uid)
                            ? Intent.PRIMARY
                            : Intent.NONE
                        }
                        onClick={() => {
                          setActiveNodeTypeFilters((prev) =>
                            prev.includes(t.uid)
                              ? prev.filter((f) => f !== t.uid)
                              : [...prev, t.uid],
                          );
                        }}
                      />
                    ))}
                    {activeNodeTypeFilters.length > 0 && (
                      <Button
                        small
                        minimal
                        icon="cross"
                        text="Clear"
                        onClick={() => setActiveNodeTypeFilters([])}
                      />
                    )}
                  </div>
                }
              >
                <Button
                  icon="filter"
                  small
                  minimal
                  intent={
                    activeNodeTypeFilters.length > 0
                      ? Intent.PRIMARY
                      : Intent.NONE
                  }
                />
              </Popover>
            )}
          </div>
          <div className="flex pr-2">
            <div className="flex-grow overflow-y-auto">
              {isSearchingHyde && (
                <Spinner size={Spinner.SIZE_SMALL} className="mb-2" />
              )}
              <ul className="list-none space-y-1 p-0">
                {!isSearchingHyde &&
                  actuallyDisplayedNodes.length > 0 &&
                  actuallyDisplayedNodes.map((node) => (
                    <li
                      key={node.uid}
                      className="flex items-center justify-between rounded-md px-1.5 py-1.5 hover:bg-gray-100"
                      onMouseEnter={() =>
                        toggleOverlayHighlight(node.uid, true)
                      }
                      onMouseLeave={() =>
                        toggleOverlayHighlight(node.uid, false)
                      }
                    >
                      <span
                        className="mr-2 cursor-pointer hover:underline"
                        onClick={(e) => {
                          if (e.shiftKey) {
                            void openBlockInSidebar(node.uid);
                          } else {
                            void window.roamAlphaAPI.ui.mainWindow.openPage({
                              page: { uid: node.uid },
                            });
                          }
                        }}
                      >
                        {node.text}
                      </span>
                      <Button
                        minimal
                        small
                        icon="add"
                        onClick={() => void handleCreateBlock(node)}
                      />
                    </li>
                  ))}
                {!isSearchingHyde && actuallyDisplayedNodes.length === 0 && (
                  <li className="px-2 py-1.5 italic text-gray-500">
                    {hydeFilteredNodes.length > 0 &&
                    activeNodeTypeFilters.length > 0
                      ? "No suggestions match the current filters."
                      : "No relevant relations found."}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuggestionsBody;
