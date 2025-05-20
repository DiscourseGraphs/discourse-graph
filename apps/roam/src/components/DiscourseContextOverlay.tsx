import {
  Button,
  Icon,
  Popover,
  Position,
  Tooltip,
  ControlGroup,
  Spinner,
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
import getDiscourseNodes, { DiscourseNode } from "~/utils/getDiscourseNodes";
import getDiscourseRelations, {
  DiscourseRelation,
} from "~/utils/getDiscourseRelations";
import ExtensionApiContextProvider from "roamjs-components/components/ExtensionApiContext";
import { OnloadArgs } from "roamjs-components/types/native";
import AutocompleteInput from "roamjs-components/components/AutocompleteInput";
import getAllPageNames from "roamjs-components/queries/getAllPageNames";
import { Result } from "roamjs-components/types/query-builder";
import createBlock from "roamjs-components/writes/createBlock";
import { getBlockUidFromTarget } from "roamjs-components/dom";
import {
  findSimilarNodesUsingHyde,
  SuggestedNode,
  RelationDetails,
  CandidateNodeWithEmbedding,
} from "~/utils/hyde";

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

  const suggestionContextData = useMemo(() => {
    const selfNode = discourseNode;

    if (!selfNode || !selfNode.text || !selfNode.format) {
      return {
        validTypes: [],
        uniqueRelationTypeTriplets: [],
      };
    }
    const selfType = selfNode.type;

    const relationsConnectingToSelf = relations.filter(
      (relation) =>
        relation.source === selfType || relation.destination === selfType,
    );

    const uniqueTriplets = useMemo(() => {
      const relatedNodeType = selfNode.type;

      return relationsConnectingToSelf.flatMap((relation) => {
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
    }, [relationsConnectingToSelf, selfNode.type, allNodes]);

    const relationsInvolvingSelfBroadly = relations.filter((relation) =>
      [relation.source, relation.destination, relation.label].includes(
        selfType,
      ),
    );
    const hasSelfRelation = relationsInvolvingSelfBroadly.some(
      (relation) =>
        relation.source === selfType && relation.destination === selfType,
    );
    const types = Array.from(
      new Set(
        relationsInvolvingSelfBroadly.flatMap((relation) => [
          relation.source,
          relation.destination,
        ]),
      ),
    );
    const filteredTypes = hasSelfRelation
      ? types
      : types.filter((type) => type !== selfType);

    return {
      validTypes: filteredTypes,
      uniqueRelationTypeTriplets: uniqueTriplets,
    };
  }, [discourseNode, relations, allNodes]);

  const { validTypes, uniqueRelationTypeTriplets } = suggestionContextData;

  const [currentPageInput, setCurrentPageInput] = useState("");
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const allPages = useMemo(() => getAllPageNames(), []);
  useEffect(() => {
    setSelectedPage(null);
  }, [currentPageInput]);

  useEffect(() => {
    if (!selectedPage) {
      setHydeFilteredNodes([]);
      return;
    }
    const nodesOnPage = getAllReferencesOnPage(selectedPage);
    const nodes = nodesOnPage
      .map((n) => {
        const node = findDiscourseNode(n.uid);
        if (!node || node.backedBy === "default") return null;
        if (!validTypes.includes(node.type)) return null;
        return {
          uid: n.uid,
          text: n.text,
          type: node.type,
        };
      })
      .filter((node): node is SuggestedNode => node !== null)
      .filter(
        (node) =>
          !results.some((r) =>
            Object.values(r.results).some((result) => result.uid === node.uid),
          ),
      );

    if (nodes.length > 0 && uniqueRelationTypeTriplets.length > 0) {
      const performSearch = async () => {
        setIsSearchingHyde(true);
        setHydeFilteredNodes([]);
        try {
          const foundNodes = await runHydeSearch({
            currentSuggestions: nodes,
            currentNodeText: tag,
            relationDetails: uniqueRelationTypeTriplets,
          });
          setHydeFilteredNodes(foundNodes);
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
      performSearch();
    }
  }, [selectedPage, results, validTypes, tag, uniqueRelationTypeTriplets]);

  const handleCreateBlock = async (node: SuggestedNode) => {
    await createBlock({
      parentUid: blockUid,
      node: { text: `[[${node.text}]]` },
    });
    setHydeFilteredNodes(hydeFilteredNodes.filter((n) => n.uid !== node.uid));
  };

  type RunHydeSearchArgs = {
    currentSuggestions: SuggestedNode[];
    currentNodeText: string;
    relationDetails: RelationDetails[];
  };

  const runHydeSearch = async ({
    currentSuggestions,
    currentNodeText,
    relationDetails,
  }: RunHydeSearchArgs): Promise<SuggestedNode[]> => {
    if (
      !currentSuggestions.length ||
      !currentNodeText ||
      !relationDetails.length
    ) {
      return [];
    }

    try {
      const candidateNodesForHyde = currentSuggestions.map((node) => ({
        uid: node.uid,
        text: node.text,
        type: node.type,
      }));

      const foundNodes: SuggestedNode[] = await findSimilarNodesUsingHyde({
        candidateNodes: candidateNodesForHyde,
        currentNodeText: currentNodeText,
        relationDetails: relationDetails,
      });

      return foundNodes;
    } catch (error) {
      console.error(
        "Error during HyDE search with default RPC subset search:",
        error,
      );
      return [];
    }
  };

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
          {/* Suggestive Mode */}
          <div>
            <div className="mt-6">
              <label
                htmlFor="suggest-page-input"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Add page to suggest relationships
              </label>
              <ControlGroup
                className="flex gap-1"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSelectedPage(currentPageInput);
                  }
                }}
              >
                <AutocompleteInput
                  value={currentPageInput}
                  placeholder="Enter page name..."
                  setValue={setCurrentPageInput}
                  options={allPages}
                  maxItemsDisplayed={50}
                />
                <Button
                  icon="tick"
                  onClick={() => setSelectedPage(currentPageInput)}
                  disabled={!currentPageInput}
                  intent={selectedPage ? "success" : "none"}
                />
              </ControlGroup>
            </div>
            {selectedPage && (
              <div className="mt-6">
                <h3 className="mb-2 text-base font-semibold">
                  Suggested Relationships
                </h3>
                {isSearchingHyde && (
                  <Spinner size={Spinner.SIZE_SMALL} className="mb-2" />
                )}
                <ul className="space-y-2">
                  {!isSearchingHyde && hydeFilteredNodes.length > 0
                    ? hydeFilteredNodes.map((node) => (
                        <li key={node.uid} className="">
                          <span>{node.text}</span>
                          <Button
                            minimal
                            icon="add"
                            onClick={() => handleCreateBlock(node)}
                            className="ml-2"
                          />
                        </li>
                      ))
                    : null}
                  {!isSearchingHyde && hydeFilteredNodes.length === 0 && (
                    <li>No relevant relations found.</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        </div>
      }
      target={
        <Button
          small
          id={id}
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
