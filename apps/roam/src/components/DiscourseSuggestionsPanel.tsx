import {
  Alignment,
  Card,
  Classes,
  Button,
  ButtonGroup,
  Navbar,
  Position,
  Tooltip,
  ControlGroup,
  Spinner,
  Intent,
  Tag,
  Divider,
  Collapse,
  Popover,
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
const PANELS_CONTAINER_ID = "discourse-graph-panels-container";

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
  const [isOpen, setIsOpen] = useState(true);

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

  const toggleHighlight = (uid: string, on: boolean) => {
    document
      .querySelectorAll(`[data-dg-block-uid="${uid}"]`)
      .forEach((el) => el.classList.toggle("dg-highlight", on));
  };

  return (
    <Card
      {...{ "data-dg-block-uid": blockUid }}
      onMouseEnter={() => toggleHighlight(blockUid, true)}
      onMouseLeave={() => toggleHighlight(blockUid, false)}
      style={{
        backgroundColor: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "8px",
      }}
      className="roamjs-discourse-suggestions-panel"
    >
      <Navbar
        style={{
          borderBottom: "1px solid #d8e1e8",
          boxShadow: "none",
          paddingRight: 0,
          display: "flex",
          flexWrap: "nowrap",
          alignItems: "center",
        }}
      >
        {/* Left-aligned group for panel heading */}
        <Navbar.Group align={Alignment.LEFT} style={{ flex: 1, minWidth: 0 }}>
          <Navbar.Heading
            className="truncate"
            style={{
              fontSize: "13px",
              margin: 0,
              fontWeight: 600,
              cursor: "pointer",
            }}
            onClick={() => setIsOpen((prev) => !prev)}
          >
            {tag}
          </Navbar.Heading>
        </Navbar.Group>

        {/* Right-aligned group for action buttons */}
        <Navbar.Group
          align={Alignment.RIGHT}
          style={{
            marginRight: "5px",
            flexShrink: 0,
            display: "flex",
            gap: "4px",
          }}
        >
          <Button
            icon={isOpen ? "chevron-up" : "chevron-down"}
            minimal
            small
            onClick={() => setIsOpen((prev) => !prev)}
            title={isOpen ? "Collapse" : "Expand"}
          />
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
      <Collapse
        isOpen={isOpen}
        keepChildrenMounted={true}
        transitionDuration={150}
      >
        <div
          className={Classes.CARD}
          style={{ flexGrow: 1, overflowY: "auto", padding: "6px" }}
        >
          {/* Suggestive Mode */}
          <div>
            <div className="mt-2">
              <label
                htmlFor="suggest-page-input"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Suggest relationships from pages
              </label>
              <ControlGroup
                fill
                className="flex flex-wrap items-center gap-2"
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
                <div className="flex-0 min-w-[160px]">
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
                      !currentPageInput ||
                      selectedPages.includes(currentPageInput)
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
                />{" "}
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
                          {availableFilterTypes.map((typeFilter) => (
                            <Button
                              key={typeFilter.uid}
                              small
                              minimal
                              fill
                              alignText="left"
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
                {/* Scrollable container for filters and suggestions list */}
                <div className="flex pr-2">
                  {" "}
                  {/* Flex container */}
                  {/* Suggestions List */}
                  <div className="flex-grow overflow-y-auto">
                    {isSearchingHyde && (
                      <Spinner size={Spinner.SIZE_SMALL} className="mb-2" />
                    )}
                    <ul className="list-none space-y-1 p-0">
                      {!isSearchingHyde && actuallyDisplayedNodes.length > 0
                        ? actuallyDisplayedNodes.map((node) => (
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
                </div>{" "}
                {/* End of scrollable container */}
              </div>
            ) : null}{" "}
            {/* Added a null fallback for the outer conditional rendering */}
          </div>
        </div>
      </Collapse>
    </Card>
  );
};

// Static method to toggle the suggestions panel
DiscourseSuggestionsPanel.toggle = (
  tag: string,
  id: string,
  parentEl: HTMLElement,
) => {
  // Ensure there is a dedicated root element for all suggestion panels.
  let suggestionsRoot = document.getElementById(
    PANEL_ROOT_ID,
  ) as HTMLElement | null;

  // Always reference Roam's main container – we need it for (un)split logic
  const roamBodyMain = document.querySelector(
    ".roam-body-main",
  ) as HTMLElement | null;

  // If the root does not exist yet, create it and apply the 40/60 split.
  if (!suggestionsRoot && roamBodyMain) {
    const mainContent = roamBodyMain.firstElementChild as HTMLElement | null;
    if (!mainContent) return; // safety-guard – shouldn't happen in a normal Roam page

    suggestionsRoot = document.createElement("div");
    suggestionsRoot.id = PANEL_ROOT_ID;
    suggestionsRoot.style.display = "flex";
    suggestionsRoot.style.flexDirection = "column";
    suggestionsRoot.style.flex = "0 0 40%";

    // Insert the root before Roam's main content area and apply split styling
    roamBodyMain.insertBefore(suggestionsRoot, mainContent);
    roamBodyMain.style.display = "flex";
    mainContent.style.flex = "1 1 60%";
    roamBodyMain.dataset.isSplit = "true";
  }

  // If we still don't have either container, bail
  if (!suggestionsRoot) return;

  // If the root exists but is currently hidden, show it again and re-apply
  // the 40/60 split layout that we use for split view.
  if (
    suggestionsRoot.style.display === "none" &&
    roamBodyMain &&
    !roamBodyMain.dataset.isSplit
  ) {
    const mainContent =
      suggestionsRoot.nextElementSibling as HTMLElement | null;
    suggestionsRoot.style.display = "flex";
    // Ensure the root is sized correctly.
    suggestionsRoot.style.flex = "0 0 40%";

    // Apply flex split styling to the parent container and main content.
    roamBodyMain.style.display = "flex";
    if (mainContent && mainContent !== suggestionsRoot) {
      mainContent.style.flex = "1 1 60%";
    }
    roamBodyMain.dataset.isSplit = "true";
  }

  // From now on, always append the panels container to `suggestionsRoot`.
  const containerParent = suggestionsRoot;

  const panelId = `discourse-panel-${tag.replace(/[^a-zA-Z0-9]/g, "-")}`;
  const existingPanel = document.getElementById(panelId);

  // If this specific panel already exists, close only this panel
  if (existingPanel) {
    ReactDOM.unmountComponentAtNode(existingPanel);
    existingPanel.remove();

    // Check if there are any remaining panels
    const panelsContainer = document.getElementById(
      PANELS_CONTAINER_ID,
    ) as HTMLElement | null;
    const remainingPanels = panelsContainer?.children.length || 0;

    if (remainingPanels === 0 && panelsContainer) {
      panelsContainer.remove();
      // Remove the suggestions root and restore layout
      if (suggestionsRoot?.parentElement) {
        suggestionsRoot.remove();
      }
      if (roamBodyMain && roamBodyMain.dataset.isSplit === "true") {
        roamBodyMain.removeAttribute("data-is-split");
        roamBodyMain.style.display = "";
        const mainContent =
          roamBodyMain.firstElementChild as HTMLElement | null;
        if (mainContent) {
          mainContent.style.flex = "";
        }
      }
    }
    return;
  }

  // Ensure there is only one panels container in the entire document
  let panelsContainer = document.getElementById(
    PANELS_CONTAINER_ID,
  ) as HTMLElement | null;

  // If a container exists but is NOT inside the intended parent, move it.
  if (panelsContainer && panelsContainer.parentElement !== containerParent) {
    panelsContainer.parentElement?.removeChild(panelsContainer);
    containerParent.appendChild(panelsContainer);
  }

  // Create the panels container if it does not exist yet
  if (!panelsContainer) {
    panelsContainer = document.createElement("div");
    panelsContainer.id = PANELS_CONTAINER_ID;
    panelsContainer.style.display = "flex";
    panelsContainer.style.flexDirection = "column";
    panelsContainer.style.flex = "1 1 auto";
    panelsContainer.style.gap = "8px";
    panelsContainer.style.padding = "8px";
    panelsContainer.style.backgroundColor = "#f5f5f5";
    panelsContainer.style.overflowY = "auto";

    containerParent.appendChild(panelsContainer);

    // Common header shown once per container
    const headerCardId = "discourse-suggestions-header";
    const headerCard = document.createElement("div");
    headerCard.id = headerCardId;
    headerCard.style.flex = "0 0 auto";
    headerCard.style.padding = "6px 8px";
    headerCard.style.backgroundColor = "#fff";
    headerCard.style.borderRadius = "4px 4px 0 0";
    headerCard.style.marginBottom = "0";
    headerCard.style.fontWeight = "600";
    headerCard.style.fontSize = "13px";
    headerCard.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
    headerCard.textContent = "Suggested Discourse nodes";

    panelsContainer.appendChild(headerCard);
  }

  // Create the new panel
  const newPanel = document.createElement("div");
  newPanel.id = panelId;
  newPanel.style.flex = "0 0 auto";
  newPanel.style.marginBottom = "8px";
  newPanel.style.marginTop = "0";
  newPanel.style.backgroundColor = "#fff";
  newPanel.style.borderRadius = "0 0 4px 4px";
  newPanel.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";

  panelsContainer.appendChild(newPanel);

  const handleClosePanel = () => {
    ReactDOM.unmountComponentAtNode(newPanel);
    newPanel.remove();

    // Check if there are any remaining panels
    const remainingPanels = panelsContainer?.children.length || 0;

    if (remainingPanels === 0) {
      panelsContainer.remove();
      // Remove the suggestions root and restore layout
      if (suggestionsRoot?.parentElement) {
        suggestionsRoot.remove();
      }
      if (roamBodyMain && roamBodyMain.dataset.isSplit === "true") {
        roamBodyMain.removeAttribute("data-is-split");
        roamBodyMain.style.display = "";
        const mainContent =
          roamBodyMain.firstElementChild as HTMLElement | null;
        if (mainContent) {
          mainContent.style.flex = "";
        }
      }
    }
  };

  ReactDOM.render(
    <DiscourseSuggestionsPanel
      onClose={handleClosePanel}
      tag={tag}
      id={id}
      parentEl={parentEl}
    />,
    newPanel,
  );
};
