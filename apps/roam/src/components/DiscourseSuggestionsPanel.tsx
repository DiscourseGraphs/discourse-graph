import {
  Alignment,
  Card,
  Classes,
  Button,
  Navbar,
  Position,
  Tooltip,
  ControlGroup,
  Spinner,
  Intent,
  Tag,
  Divider,
} from "@blueprintjs/core";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import deriveDiscourseNodeAttribute from "~/utils/deriveDiscourseNodeAttribute";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import findDiscourseNode from "~/utils/findDiscourseNode";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { Result } from "roamjs-components/types/query-builder";
import createBlock from "roamjs-components/writes/createBlock";
import { getBlockUidFromTarget } from "roamjs-components/dom";
import openBlockInSidebar from "roamjs-components/writes/openBlockInSidebar";
import {
  SuggestedNode,
  RelationDetails,
  findSimilarNodesUsingHyde,
} from "~/utils/hyde";

const PANEL_ROOT_ID = "discourse-graph-suggestions-root";

type DiscourseData = {
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

const getAllReferencesOnPage = (pageTitle: string) => {
  const referencedPages = window.roamAlphaAPI.data.q(
    `[:find ?uid ?text
      :where
        [?page :node/title "${normalizePageTitle(pageTitle)}"]
        [?b :block/page ?page]
        [?b :block/refs ?refPage]
        [?refPage :block/uid ?uid]
        [?refPage :node/title ?text]]`,
  );
  return referencedPages.map(([uid, text]) => ({
    uid,
    text,
  })) as Result[];
};

export const DiscourseSuggestionsPanel = ({
  onClose,
  tag,
  id,
  parentEl,
}: {
  onClose: () => void;
  tag: string;
  id: string;
  parentEl: HTMLElement;
}) => {
  const tagUid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const blockUid = useMemo(() => getBlockUidFromTarget(parentEl), [parentEl]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiscourseData["results"]>([]);
  const [refs, setRefs] = useState(0);
  const [score, setScore] = useState<number | string>(0);
  const [isSearchingHyde, setIsSearchingHyde] = useState(false);
  const [hydeFilteredNodes, setHydeFilteredNodes] = useState<SuggestedNode[]>(
    [],
  );
  const [useAllPagesForSuggestions, setUseAllPagesForSuggestions] =
    useState(false);
  const [selectedPages, setSelectedPages] = useState<string[]>([]);
  const [searchNonce, setSearchNonce] = useState(0);
  const [autocompleteKey, setAutocompleteKey] = useState(0);
  const [activeNodeTypeFilters, setActiveNodeTypeFilters] = useState<string[]>(
    [],
  );

  const discourseNode = useMemo(() => findDiscourseNode(tagUid), [tagUid]);
  const relations = useMemo(() => getDiscourseRelations(), []);
  const allNodes = useMemo(() => getDiscourseNodes(), []);

  const getInfo = useCallback(
    () =>
      getOverlayInfo(tag, relations)
        .then(({ refs, results }) => {
          if (!discourseNode) return;
          const attribute = getSettingValueFromTree({
            tree: getBasicTreeByParentUid(discourseNode.type),
            key: "Overlay",
            defaultValue: "Overlay",
          });
          return deriveDiscourseNodeAttribute({
            uid: tagUid,
            attribute,
          }).then((score) => {
            setResults(results);
            setRefs(refs);
            setScore(score);
          });
        })
        .finally(() => setLoading(false)),
    [tag, setResults, setLoading, setRefs, setScore],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    getInfo();
  }, [getInfo, setLoading]);

  useEffect(() => {
    getInfo();
  }, [refresh, getInfo]);

  const validRelations = useMemo(() => {
    if (!discourseNode) return [];
    const selfType = discourseNode.type;

    return relations.filter(
      (relation) =>
        relation.source === selfType || relation.destination === selfType,
    );
  }, [relations, discourseNode]);

  const uniqueRelationTypeTriplets = useMemo(() => {
    if (!discourseNode) return [];
    const relatedNodeType = discourseNode.type;

    return validRelations.flatMap((relation) => {
      const isSelfSource = relation.source === relatedNodeType;
      const isSelfDestination = relation.destination === relatedNodeType;

      let targetNodeType: string;
      let currentRelationLabel: string;

      if (isSelfSource) {
        targetNodeType = relation.destination;
        currentRelationLabel = relation.label;
      } else if (isSelfDestination) {
        targetNodeType = relation.source;
        currentRelationLabel = relation.complement;
      } else {
        return [];
      }

      const identifiedTargetNode = allNodes.find(
        (node) => node.type === targetNodeType,
      );

      if (!identifiedTargetNode) {
        return [];
      }

      const mappedItem: RelationDetails = {
        relationLabel: currentRelationLabel,
        relatedNodeText: identifiedTargetNode.text,
        relatedNodeFormat: identifiedTargetNode.format,
      };
      return [mappedItem];
    });
  }, [validRelations, discourseNode, allNodes]);

  console.log("uniqueRelationTypeTriplets", uniqueRelationTypeTriplets);

  const validTypes = useMemo(() => {
    if (!discourseNode) return [];
    const selfType = discourseNode.type;

    const hasSelfRelation = validRelations.some(
      (relation) =>
        relation.source === selfType && relation.destination === selfType,
    );
    const types = Array.from(
      new Set(
        validRelations.flatMap((relation) => [
          relation.source,
          relation.destination,
        ]),
      ),
    );
    return hasSelfRelation ? types : types.filter((type) => type !== selfType);
  }, [discourseNode, validRelations]);

  console.log("validTypes", validTypes);

  console.log("searchNonce", searchNonce);

  const [currentPageInput, setCurrentPageInput] = useState("");
  const allPages = useMemo(() => getAllPageNames(), []);

  useEffect(() => {
    setHydeFilteredNodes([]);
    setIsSearchingHyde(false);
  }, [selectedPages, useAllPagesForSuggestions]);

  useEffect(() => {
    const performHydeSearch = async () => {
      console.log("performHydeSearch");
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
          console.log("useAllPagesForSuggestions");
          candidateNodesForHyde = allPages
            .map((pageName) => {
              const pageUid = getPageUidByPageTitle(pageName);
              if (!pageUid || pageUid === tagUid) {
                return null;
              }
              const node = findDiscourseNode(pageUid);
              if (
                !node ||
                node.backedBy === "default" ||
                !validTypes.includes(node.type) ||
                results.some((r) =>
                  Object.values(r.results).some(
                    (result) => result.uid === pageUid,
                  ),
                )
              ) {
                return null;
              }
              return { uid: pageUid, text: pageName, type: node.type };
            })
            .filter((node): node is SuggestedNode => node !== null);
        } else if (selectedPages.length > 0 && !useAllPagesForSuggestions) {
          console.log("selectedPages.length > 0 && !useAllPagesForSuggestions");
          let allReferencedNodesFromSelectedPages: {
            uid: string;
            text: string;
          }[] = [];

          for (const pageName of selectedPages) {
            const nodesOnThisPage = getAllReferencesOnPage(pageName);
            allReferencedNodesFromSelectedPages.push(...nodesOnThisPage);
          }
          console.log(
            "allReferencedNodesFromSelectedPages",
            allReferencedNodesFromSelectedPages,
          );
          const uniqueReferencedNodes = Array.from(
            new Map(
              allReferencedNodesFromSelectedPages.map((item) => [
                item.uid,
                item,
              ]),
            ).values(),
          );

          candidateNodesForHyde = uniqueReferencedNodes
            .map((n) => {
              const node = findDiscourseNode(n.uid);
              if (
                !node ||
                node.backedBy === "default" ||
                !validTypes.includes(node.type) ||
                results.some((r) =>
                  Object.values(r.results).some(
                    (result) => result.uid === n.uid,
                  ),
                ) ||
                n.uid === tagUid
              ) {
                return null;
              }
              return { uid: n.uid, text: n.text, type: node.type };
            })
            .filter((node): node is SuggestedNode => node !== null);
        } else {
          console.log("else");
          setHydeFilteredNodes([]);
          setIsSearchingHyde(false);
          return;
        }

        if (
          candidateNodesForHyde.length > 0 &&
          uniqueRelationTypeTriplets.length > 0
        ) {
          console.log("findSimilarNodesUsingHyde");
          const foundNodes: SuggestedNode[] = await findSimilarNodesUsingHyde({
            candidateNodes: candidateNodesForHyde,
            currentNodeText: tag,
            relationDetails: uniqueRelationTypeTriplets,
          });
          console.log("foundNodes", foundNodes);
          setHydeFilteredNodes(foundNodes);
        } else {
          console.log("else");
          setHydeFilteredNodes([]);
        }
      } catch (error) {
        console.error(
          "Error during HyDE search operation in useEffect:",
          error,
        );
        setHydeFilteredNodes([]);
      } finally {
        setIsSearchingHyde(false);
      }
    };

    if (searchNonce > 0) {
      performHydeSearch();
    }
  }, [searchNonce]);

  const handleCreateBlock = async (node: SuggestedNode) => {
    await createBlock({
      parentUid: blockUid,
      node: { text: `[[${node.text}]]` },
    });
    setHydeFilteredNodes(hydeFilteredNodes.filter((n) => n.uid !== node.uid));
  };

  const uniqueSuggestedTypeUIDs = useMemo(
    () => Array.from(new Set(hydeFilteredNodes.map((node) => node.type))),
    [hydeFilteredNodes],
  );

  const availableFilterTypes = useMemo(() => {
    return uniqueSuggestedTypeUIDs
      .map((uid) => {
        const nodeDef = allNodes.find((n) => n.type === uid);
        return { uid: uid, text: nodeDef ? nodeDef.text : uid };
      })
      .sort((a, b) => a.text.localeCompare(b.text));
  }, [uniqueSuggestedTypeUIDs, allNodes]);

  const actuallyDisplayedNodes = useMemo(() => {
    if (activeNodeTypeFilters.length === 0) {
      return hydeFilteredNodes;
    }
    return hydeFilteredNodes.filter((node) =>
      activeNodeTypeFilters.includes(node.type),
    );
  }, [hydeFilteredNodes, activeNodeTypeFilters]);

  return (
    <Card
      style={{
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: 0,
        height: "100%",
      }}
      className="roamjs-discourse-suggestions-panel"
    >
      <Navbar
        style={{
          borderBottom: "1px solid #d8e1e8",
          boxShadow: "none",
        }}
      >
        <Navbar.Group align={Alignment.LEFT}>
          <Navbar.Heading
            style={{ fontSize: "14px", margin: 0, fontWeight: 600 }}
          >
            Suggested Discourse nodes
          </Navbar.Heading>
        </Navbar.Group>
        <Navbar.Group align={Alignment.RIGHT}>
          <Button icon="cog" minimal={true} title="Settings" small={true} />
          <Button
            icon="cross"
            minimal={true}
            title="Close Panel"
            onClick={onClose}
            small={true}
          />
        </Navbar.Group>
      </Navbar>
      <div
        className={Classes.CARD}
        style={{ flexGrow: 1, overflowY: "auto", padding: "10px" }}
      >
        {/* Suggestive Mode */}
        <div>
          <div className="mb-3 flex items-center justify-between border-b pb-2">
            <h3 className="text-lg font-semibold text-gray-800">
              Suggested Relationships
            </h3>
          </div>
          <div className="mt-2">
            <label
              htmlFor="suggest-page-input"
              className={`mb-1 block text-sm font-medium text-gray-700`}
            >
              Add page(s) to suggest relationships
            </label>
            <ControlGroup
              className="flex items-center gap-1"
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
                placeholder={"Enter page name to add..."}
                setValue={setCurrentPageInput}
                options={allPages}
                maxItemsDisplayed={50}
              />
              <Tooltip
                content={
                  selectedPages.includes(currentPageInput)
                    ? "Page already added"
                    : "Add page for suggestions"
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
                    !currentPageInput ||
                    selectedPages.includes(currentPageInput)
                  }
                />
              </Tooltip>
              <Button
                text="Find Suggestions"
                icon="search-template"
                intent={Intent.PRIMARY}
                onClick={() => {
                  setUseAllPagesForSuggestions(false);
                  setSearchNonce((prev) => prev + 1);
                }}
                disabled={selectedPages.length === 0}
                small
              />{" "}
              <div>
                <Tooltip
                  content={
                    useAllPagesForSuggestions
                      ? "Refresh suggestions from all pages"
                      : "Suggest relationships from all pages in your graph"
                  }
                >
                  <Button
                    text="Use All Pages for Suggestions"
                    icon="globe-network"
                    small
                    onClick={() => {
                      setUseAllPagesForSuggestions(true);
                      setSelectedPages([]);
                      setCurrentPageInput("");
                      setAutocompleteKey((prev) => prev + 1);
                      setSearchNonce((prev) => prev + 1);
                    }}
                  />
                </Tooltip>
              </div>
            </ControlGroup>
            {selectedPages.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {selectedPages.map((pageName) => (
                  <Tag
                    key={pageName}
                    onRemove={() => {
                      setSelectedPages((prev) =>
                        prev.filter((p) => p !== pageName),
                      );
                      if (selectedPages.length === 1) {
                        setHydeFilteredNodes([]);
                        setIsSearchingHyde(false);
                      }
                    }}
                    round
                    minimal
                  >
                    {pageName}
                  </Tag>
                ))}
              </div>
            )}
          </div>
          {/* Conditionally render suggestions based on if a search has been run or criteria exist */}
          {hydeFilteredNodes.length > 0 ||
          isSearchingHyde ||
          (searchNonce > 0 &&
            (useAllPagesForSuggestions || selectedPages.length > 0)) ? (
            <div className="mt-6">
              <h3 className="mb-2 text-base font-semibold">
                {useAllPagesForSuggestions
                  ? "From All Pages"
                  : selectedPages.length > 0
                    ? `From ${selectedPages.length === 1 ? `"${selectedPages[0]}"` : `${selectedPages.length} selected pages`}`
                    : "Select pages to see suggestions"}
              </h3>
              {/* Scrollable container for filters and suggestions list */}
              <div className="flex max-h-96 gap-4 pr-2">
                {" "}
                {/* Flex container */}
                {/* Suggestions List */}
                <div className="flex-grow overflow-y-auto">
                  {isSearchingHyde && (
                    <Spinner size={Spinner.SIZE_SMALL} className="mb-2" />
                  )}
                  <ul className="space-y-1">
                    {!isSearchingHyde && actuallyDisplayedNodes.length > 0
                      ? actuallyDisplayedNodes.map((node) => (
                          <li
                            key={node.uid}
                            className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-gray-100"
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
                            >
                              <Button
                                minimal
                                small
                                icon="add"
                                onClick={() => handleCreateBlock(node)}
                                className="ml-2"
                              />
                            </Tooltip>
                          </li>
                        ))
                      : null}
                    {!isSearchingHyde &&
                      actuallyDisplayedNodes.length === 0 && (
                        <li className="px-2 py-1.5 italic text-gray-500">
                          {hydeFilteredNodes.length > 0 &&
                          activeNodeTypeFilters.length > 0
                            ? "No suggestions match the current filters."
                            : "No relevant relations found."}
                        </li>
                      )}
                  </ul>
                </div>
                {/* Node Type Filter UI - Placed to the right */}
                {hydeFilteredNodes.length > 0 &&
                  availableFilterTypes.length > 1 && (
                    <div className="w-48 flex-shrink-0 border-l border-gray-200 pl-3">
                      {" "}
                      {/* Adjusted width and added border */}
                      <div className="mb-1 text-sm font-medium text-gray-700">
                        Filter by Node Type:
                      </div>
                      <div className="space-y-1">
                        {availableFilterTypes.map((typeFilter) => (
                          <Button
                            key={typeFilter.uid}
                            small
                            minimal
                            fill // Make button take full width of its container
                            alignText="left" // Align text to the left
                            text={typeFilter.text}
                            intent={
                              activeNodeTypeFilters.includes(typeFilter.uid)
                                ? Intent.PRIMARY
                                : Intent.NONE
                            }
                            onClick={() => {
                              setActiveNodeTypeFilters((prevFilters) =>
                                prevFilters.includes(typeFilter.uid)
                                  ? prevFilters.filter(
                                      (f) => f !== typeFilter.uid,
                                    )
                                  : [...prevFilters, typeFilter.uid],
                              );
                            }}
                            className="w-full justify-start" // Ensure button text starts from left
                          />
                        ))}
                      </div>
                      {activeNodeTypeFilters.length > 0 && (
                        <div className="mt-1.5">
                          <Button
                            small
                            minimal
                            icon="cross"
                            text="Clear Filters"
                            onClick={() => setActiveNodeTypeFilters([])}
                            className="text-xs"
                          />
                        </div>
                      )}
                    </div>
                  )}
              </div>{" "}
              {/* End of scrollable container */}
            </div>
          ) : null}{" "}
          {/* Added a null fallback for the outer conditional rendering */}
        </div>
      </div>
    </Card>
  );
};

// Static method to toggle the suggestions panel
DiscourseSuggestionsPanel.toggle = (
  tag: string,
  id: string,
  parentEl: HTMLElement,
) => {
  const roamBodyMain = document.querySelector(
    ".roam-body-main",
  ) as HTMLElement | null;
  if (!roamBodyMain) return;

  const isSplit = roamBodyMain.dataset.isSplit === "true";

  if (isSplit) {
    const panelRoot = document.getElementById(PANEL_ROOT_ID);
    if (panelRoot) {
      ReactDOM.unmountComponentAtNode(panelRoot);
      panelRoot.remove();
    }
    roamBodyMain.removeAttribute("data-is-split");
    roamBodyMain.style.display = "";
    const mainContent = roamBodyMain.firstElementChild as HTMLElement | null;
    if (mainContent) {
      mainContent.style.flex = "";
    }
  } else {
    const mainContent = roamBodyMain.firstElementChild as HTMLElement | null;
    if (!mainContent) return;

    const panelRoot = document.createElement("div");
    panelRoot.id = PANEL_ROOT_ID;

    roamBodyMain.insertBefore(panelRoot, mainContent);

    roamBodyMain.style.display = "flex";
    panelRoot.style.flex = "0 0 40%";
    mainContent.style.flex = "1 1 60%";
    roamBodyMain.dataset.isSplit = "true";

    ReactDOM.render(
      <DiscourseSuggestionsPanel
        onClose={() => DiscourseSuggestionsPanel.toggle(tag, id, parentEl)}
        tag={tag}
        id={id}
        parentEl={parentEl}
      />,
      panelRoot,
    );
  }
};
