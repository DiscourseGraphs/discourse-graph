import {
  Button,
  Icon,
  Popover,
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
import { ContextContent } from "./DiscourseContext";
import useInViewport from "react-in-viewport/dist/es/lib/useInViewport";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import deriveDiscourseNodeAttribute from "~/utils/deriveDiscourseNodeAttribute";
import getSettingValueFromTree from "roamjs-components/util/getSettingValueFromTree";
import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import nanoid from "nanoid";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import getDiscourseContextResults from "~/utils/getDiscourseContextResults";
import findDiscourseNode from "~/utils/findDiscourseNode";
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types/native";
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
import { DiscourseSuggestionsPanel } from "./DiscourseSuggestionsPanel";

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

const DiscourseContextOverlay = ({
  tag,
  id,
  parentEl,
}: {
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

  const [currentPageInput, setCurrentPageInput] = useState("");
  const allPages = useMemo(() => getAllPageNames(), []);

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
          let allReferencedNodesFromSelectedPages: {
            uid: string;
            text: string;
          }[] = [];
          for (const pageName of selectedPages) {
            const nodesOnThisPage = getAllReferencesOnPage(pageName);
            allReferencedNodesFromSelectedPages.push(...nodesOnThisPage);
          }

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
          setHydeFilteredNodes([]);
          setIsSearchingHyde(false);
          return;
        }

        if (
          candidateNodesForHyde.length > 0 &&
          uniqueRelationTypeTriplets.length > 0
        ) {
          const foundNodes: SuggestedNode[] = await findSimilarNodesUsingHyde({
            candidateNodes: candidateNodesForHyde,
            currentNodeText: tag,
            relationDetails: uniqueRelationTypeTriplets,
          });
          setHydeFilteredNodes(foundNodes);
        } else {
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

  const toggleHighlight = (uid: string, on: boolean) => {
    document
      .querySelectorAll(`[data-dg-block-uid="${uid}"]`)
      .forEach((el) => el.classList.toggle("dg-highlight", on));
  };

  const actuallyDisplayedNodes = useMemo(() => {
    if (activeNodeTypeFilters.length === 0) {
      return hydeFilteredNodes;
    }
    return hydeFilteredNodes.filter((node) =>
      activeNodeTypeFilters.includes(node.type),
    );
  }, [hydeFilteredNodes, activeNodeTypeFilters]);

  return (
    <Popover
      autoFocus={false}
      content={
        <div
          className={`roamjs-discourse-context-popover relative max-w-3xl p-4 ${
            results.length === 0 ? "flex items-center justify-center" : ""
          }`}
        >
          <ContextContent uid={tagUid} results={results} />
        </div>
      }
      target={
        <Button
          small
          id={id}
          {...{ "data-dg-block-uid": blockUid }}
          onMouseEnter={() => toggleHighlight(blockUid, true)}
          onMouseLeave={() => toggleHighlight(blockUid, false)}
          className={"roamjs-discourse-context-overlay"}
          style={{
            minHeight: "initial",
            paddingTop: ".25rem",
            paddingBottom: ".25rem",
          }}
          minimal
          disabled={loading}
        >
          <div className="flex items-center gap-1.5">
            <Icon icon={"diagram-tree"} />
            <span className="mr-1 leading-none">{score}</span>
            <Icon icon={"link"} />
            <span className="leading-none">{refs}</span>
            <Tooltip
              content="Open suggestions panel"
              hoverOpenDelay={200}
              hoverCloseDelay={0}
              position={Position.RIGHT}
            >
              <Button
                icon="panel-stats"
                minimal
                small
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  DiscourseSuggestionsPanel.toggle(tag, id, parentEl);
                }}
              />
            </Tooltip>
          </div>
        </Button>
      }
      position={Position.BOTTOM}
    />
  );
};

const Wrapper = ({ parent, tag }: { parent: HTMLElement; tag: string }) => {
  const id = useMemo(() => nanoid(), []);
  const { inViewport } = useInViewport(
    { current: parent },
    {},
    { disconnectOnLeave: false },
    {},
  );
  return inViewport ? (
    <DiscourseContextOverlay tag={tag} id={id} parentEl={parent} />
  ) : (
    <Button
      small
      id={id}
      minimal
      className={"roamjs-discourse-context-overlay"}
      disabled={true}
    >
      <div className="flex items-center gap-1.5">
        <Icon icon={"diagram-tree"} />
        <span className="mr-1">0</span>
        <Icon icon={"link"} />
        <span>0</span>
      </div>
    </Button>
  );
};

export const render = ({
  tag,
  parent,
  onloadArgs,
}: {
  tag: string;
  parent: HTMLElement;
  onloadArgs: OnloadArgs;
}) => {
  parent.style.margin = "0 8px";
  parent.onmousedown = (e) => e.stopPropagation();
  ReactDOM.render(
    <ExtensionApiContextProvider {...onloadArgs}>
      <Wrapper tag={tag} parent={parent} />
    </ExtensionApiContextProvider>,
    parent,
  );
};

export default DiscourseContextOverlay;
