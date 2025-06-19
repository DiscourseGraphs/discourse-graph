import React, { useEffect, useMemo, useState } from "react";
import {
  Button,
  ControlGroup,
  Intent,
  Position,
  Popover,
  Spinner,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import createBlock from "roamjs-components/writes/createBlock";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import findDiscourseNode from "~/utils/findDiscourseNode";
import { SuggestedNode, findSimilarNodesUsingHyde } from "~/utils/hyde";
import {
  getAllReferencesOnPage,
  useDiscourseData,
} from "~/utils/useDiscourseData";

interface Props {
  tag: string;
  blockUid: string;
  existingResults: any[];
}

const SuggestionsBody: React.FC<Props> = ({
  tag,
  blockUid,
  existingResults,
}) => {
  const {
    tagUid,
    discourseNode,
    validRelations,
    uniqueRelationTypeTriplets,
    validTypes,
    allNodes,
  } = useDiscourseData(tag);
  const allPages = useMemo(() => getAllPageNames(), []);

  // UI states
  const [currentPageInput, setCurrentPageInput] = useState("");
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [useAllPagesForSuggestions, setUseAllPagesForSuggestions] =
    useState(false);
  const [searchNonce, setSearchNonce] = useState(0);
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [isSearchingHyde, setIsSearchingHyde] = useState(false);
  const [hydeFilteredNodes, setHydeFilteredNodes] = useState<SuggestedNode[]>(
    [],
  );
  const [activeNodeTypeFilters, setActiveNodeTypeFilters] = useState<string[]>(
    [],
  );

  useEffect(() => {
    setHydeFilteredNodes([]);
    setIsSearchingHyde(false);
  }, [selectedPages, useAllPagesForSuggestions]);

  useEffect(() => {
    const performHydeSearch = async () => {
      if (!useAllPagesForSuggestions && selectedPages.length === 0) {
        setHydeFilteredNodes([]);
        setIsSearchingHyde(false);
        return;
      }

      if (!discourseNode) {
        setHydeFilteredNodes([]);
        return;
      }

      let candidateNodesForHyde: SuggestedNode[] = [];
      setIsSearchingHyde(true);
      setHydeFilteredNodes([]);

      try {
        if (useAllPagesForSuggestions) {
          candidateNodesForHyde = allPages
            .map((pageName) => {
              const pageUid = getPageUidByPageTitle(pageName);
              if (!pageUid || pageUid === tagUid) return null;
              const node = findDiscourseNode(pageUid);
              if (
                !node ||
                node.backedBy === "default" ||
                !validTypes.includes(node.type) ||
                existingResults.some((r: any) =>
                  (Object.values<any>(r.results) as any[]).some(
                    (result: any) => result.uid === pageUid,
                  ),
                )
              ) {
                return null;
              }
              return {
                uid: pageUid,
                text: pageName,
                type: node.type,
              } as SuggestedNode;
            })
            .filter((n): n is SuggestedNode => n !== null);
        } else {
          // From selected pages
          let referenced: { uid: string; text: string }[] = [];
          selectedPages.forEach((p) => {
            referenced.push(...getAllReferencesOnPage(p));
          });
          const uniqueReferenced = Array.from(
            new Map(referenced.map((x) => [x.uid, x])).values(),
          );
          candidateNodesForHyde = uniqueReferenced
            .map((n) => {
              const node = findDiscourseNode(n.uid);
              if (
                !node ||
                node.backedBy === "default" ||
                !validTypes.includes(node.type) ||
                existingResults.some((r: any) =>
                  (Object.values<any>(r.results) as any[]).some(
                    (result: any) => result.uid === n.uid,
                  ),
                ) ||
                n.uid === tagUid
              ) {
                return null;
              }
              return {
                uid: n.uid,
                text: n.text,
                type: node.type,
              } as SuggestedNode;
            })
            .filter((n): n is SuggestedNode => n !== null);
        }

        if (candidateNodesForHyde.length && uniqueRelationTypeTriplets.length) {
          const found = await findSimilarNodesUsingHyde({
            candidateNodes: candidateNodesForHyde,
            currentNodeText: tag,
            relationDetails: uniqueRelationTypeTriplets,
          });
          setHydeFilteredNodes(found);
        } else {
          setHydeFilteredNodes([]);
        }
      } catch (e) {
        console.error("HyDE search error", e);
        setHydeFilteredNodes([]);
      } finally {
        setIsSearchingHyde(false);
      }
    };

    if (searchNonce > 0) performHydeSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchNonce]);

  const handleCreateBlock = async (node: SuggestedNode) => {
    await createBlock({
      parentUid: blockUid,
      node: { text: `[[${node.text}]]` },
    });
    setHydeFilteredNodes((prev) => prev.filter((n) => n.uid !== node.uid));
  };

  const actuallyDisplayedNodes = useMemo(() => {
    if (activeNodeTypeFilters.length === 0) return hydeFilteredNodes;
    return hydeFilteredNodes.filter((n) =>
      activeNodeTypeFilters.includes(n.type),
    );
  }, [hydeFilteredNodes, activeNodeTypeFilters]);

  // Helper for filter dropdown
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

  // --- UI ---
  return (
    <div onMouseDown={(e) => e.stopPropagation()}>
      <div className="mt-2">
        <label
          htmlFor="suggest-page-input"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Suggest relationships from pages
        </label>
        <ControlGroup fill className="flex flex-wrap items-center gap-2">
          <div
            className="flex-0 min-w-[160px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && currentPageInput) {
                e.preventDefault();
                e.stopPropagation();
                if (
                  currentPageInput &&
                  !selectedPages.includes(currentPageInput)
                ) {
                  setSelectedPages((prev) => [...prev, currentPageInput]);
                  setTimeout(() => {
                    setCurrentPageInput("");
                    setAutocompleteKey((prev) => prev + 1);
                  }, 0);
                  setUseAllPagesForSuggestions(false);
                }
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
          <Tooltip
            content={
              selectedPages.includes(currentPageInput)
                ? "Page already added"
                : "Add page"
            }
            disabled={!currentPageInput}
          >
            <Button
              icon="plus"
              small
              onClick={() => {
                if (
                  currentPageInput &&
                  !selectedPages.includes(currentPageInput)
                ) {
                  setSelectedPages((prev) => [...prev, currentPageInput]);
                  setTimeout(() => {
                    setCurrentPageInput("");
                    setAutocompleteKey((prev) => prev + 1);
                  }, 0);
                  setUseAllPagesForSuggestions(false);
                }
              }}
              disabled={
                !currentPageInput || selectedPages.includes(currentPageInput)
              }
              className="whitespace-nowrap"
            />
          </Tooltip>
          <Button
            text="Find"
            icon="search-template"
            intent={Intent.PRIMARY}
            onClick={() => {
              setUseAllPagesForSuggestions(false);
              setSearchNonce((prev) => prev + 1);
            }}
            disabled={selectedPages.length === 0}
            small
            className="whitespace-nowrap"
          />
          <div>
            <Tooltip
              content={
                useAllPagesForSuggestions
                  ? "Refresh suggestions from all pages"
                  : "Use all pages"
              }
            >
              <Button
                text="All Pages"
                icon="globe-network"
                small
                onClick={() => {
                  setUseAllPagesForSuggestions(true);
                  setSelectedPages([]);
                  setCurrentPageInput("");
                  setAutocompleteKey((prev) => prev + 1);
                  setSearchNonce((prev) => prev + 1);
                }}
                className="whitespace-nowrap"
              />
            </Tooltip>
          </div>
        </ControlGroup>
        {selectedPages.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {selectedPages.map((p) => (
              <Tag
                key={p}
                onRemove={() => {
                  setSelectedPages((prev) => prev.filter((x) => x !== p));
                  if (selectedPages.length === 1) {
                    setHydeFilteredNodes([]);
                    setIsSearchingHyde(false);
                  }
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
        (searchNonce > 0 &&
          (useAllPagesForSuggestions || selectedPages.length > 0))) && (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-base font-semibold">
              {useAllPagesForSuggestions
                ? "From All Pages"
                : selectedPages.length > 0
                  ? `From ${selectedPages.length === 1 ? `"${selectedPages[0]}"` : `${selectedPages.length} selected pages`}`
                  : "Select pages to see suggestions"}
            </h3>
            <span className="ml-2 text-sm font-semibold text-gray-900">
              {actuallyDisplayedNodes.length}
            </span>
            {availableFilterTypes.length > 1 && (
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
                        className="w-full justify-start whitespace-nowrap"
                      />
                    ))}
                    {activeNodeTypeFilters.length > 0 && (
                      <Button
                        small
                        minimal
                        icon="cross"
                        text="Clear"
                        onClick={() => setActiveNodeTypeFilters([])}
                        className="whitespace-nowrap text-xs"
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
                    >
                      <span
                        className="mr-2 cursor-pointer hover:underline"
                        onClick={(e) => {
                          if (e.shiftKey) {
                            openBlockInSidebar(node.uid);
                          } else {
                            window.roamAlphaAPI.ui.mainWindow.openPage({
                              page: { uid: node.uid },
                            });
                          }
                        }}
                      >
                        {node.text}
                      </span>
                      <Tooltip
                        content={`Add "${node.text}" as a block reference`}
                        hoverOpenDelay={200}
                        hoverCloseDelay={0}
                        position={Position.RIGHT}
                      >
                        <Button
                          minimal
                          small
                          icon="add"
                          onClick={() => handleCreateBlock(node)}
                          className="ml-2 whitespace-nowrap"
                        />
                      </Tooltip>
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
