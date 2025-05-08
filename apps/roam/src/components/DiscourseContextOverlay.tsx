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
import getDiscourseNodes from "~/utils/getDiscourseNodes";
import getDiscourseRelations from "~/utils/getDiscourseRelations";
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
  generateHypotheticalNode,
  CandidateNodeWithEmbedding,
  SearchResultItem,
  EmbeddingVector,
} from "~/utils/hyde";

// Placeholder for future implementation
const mockCreateEmbedding = async (text: string): Promise<number[]> => {
  console.warn(
    `mockCreateEmbedding called for text: "${text}". Using dummy random embedding.`,
  );
  // Return a dummy embedding, matching the dimension (5) used elsewhere for candidate embeddings.
  return Array.from({ length: 5 }, () => Math.random());
};

// Placeholder for future implementation
const mockVectorSearch = async (
  _queryEmbedding: EmbeddingVector,
  candidates: CandidateNodeWithEmbedding[],
  options: { topK: number } = { topK: 3 },
): Promise<SearchResultItem[]> => {
  const { topK } = options;
  const numToReturn = Math.min(topK, candidates.length);
  console.warn(
    `mockVectorSearch called with ${candidates.length} candidates. Returning top ${numToReturn} as dummy results.`,
  );
  // For a simple mock, return the first few candidates, wrapping them as SearchResultItem.
  const resultCandidates = candidates.slice(0, numToReturn);
  return resultCandidates.map((node) => ({
    object: { uid: node.uid, text: node.text, type: node.type },
    score: Math.random(), // Assign a dummy score
  }));
};

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

type Relation = {
  label: string;
  source: string;
  destination: string;
};

type DiscourseNodeInfo = {
  format: string;
  text: string;
  type: string;
  [key: string]: any;
};

const getUniqueLabelTypeTriplets = (
  relations: Relation[],
  selfType: string,
): [string, string, string][] => {
  const uniquePairStrings = new Set<string>();
  const separator = "::";

  const allNodes = getDiscourseNodes();
  const nodeMapByType = new Map<string, DiscourseNodeInfo>();
  allNodes.forEach((node) => {
    const discourseNode = node as DiscourseNodeInfo;
    if (discourseNode.type) {
      nodeMapByType.set(discourseNode.type, discourseNode);
    }
  });

  for (const relation of relations) {
    if (relation.label && relation.source && relation.source !== selfType) {
      uniquePairStrings.add(`${relation.label}${separator}${relation.source}`);
    }
    if (
      relation.label &&
      relation.destination &&
      relation.destination !== selfType
    ) {
      uniquePairStrings.add(
        `${relation.label}${separator}${relation.destination}`,
      );
    }
  }

  const uniqueTriplets: [string, string, string][] = [];
  Array.from(uniquePairStrings).forEach((pairString) => {
    const parts = pairString.split(separator);
    const label = parts[0];
    const typeIdentifier = parts[1];

    const node = nodeMapByType.get(typeIdentifier);

    if (node) {
      uniqueTriplets.push([label, node.text, node.format]);
    } else {
      console.warn(
        `Discourse node type "${typeIdentifier}" not found for relation label "${label}".`,
      );
    }
  });

  return uniqueTriplets;
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
  const [suggestedNodes, setSuggestedNodes] = useState<SuggestedNode[]>([]);
  const [hydeFilteredNodes, setHydeFilteredNodes] = useState<SuggestedNode[]>(
    [],
  );

  const discourseNode = useMemo(() => findDiscourseNode(tagUid), [tagUid]);
  const relations = useMemo(() => getDiscourseRelations(), []);

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

  // Suggestive Mode
  const memoizedData = useMemo(() => {
    if (!discourseNode)
      return {
        validTypes: [] as string[],
        uniqueRelationTypeTriplets: [] as [string, string, string][],
      };
    const selfType = discourseNode.type;
    const validRelations = relations.filter((relation) =>
      [relation.source, relation.destination, relation.label].includes(
        selfType,
      ),
    );
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
    const filteredTypes = hasSelfRelation
      ? types
      : types.filter((type) => type !== selfType);

    const uniqueTriplets = getUniqueLabelTypeTriplets(validRelations, selfType);
    return {
      validTypes: filteredTypes,
      uniqueRelationTypeTriplets: uniqueTriplets,
    };
  }, [discourseNode, relations]);

  const { validTypes, uniqueRelationTypeTriplets } = memoizedData;

  const [currentPageInput, setCurrentPageInput] = useState("");
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const allPages = useMemo(() => getAllPageNames(), []);
  useEffect(() => {
    setSelectedPage(null);
  }, [currentPageInput]);

  useEffect(() => {
    if (!selectedPage) {
      setSuggestedNodes([]);
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

    setSuggestedNodes(nodes);

    if (nodes.length > 0 && uniqueRelationTypeTriplets.length > 0) {
      runHydeSearch(nodes, tag, uniqueRelationTypeTriplets);
    }
  }, [selectedPage, results, validTypes, tag, uniqueRelationTypeTriplets]);

  const handleCreateBlock = async (nodeText: string) => {
    await createBlock({
      parentUid: blockUid,
      node: { text: `[[${nodeText}]]` },
    });
  };

  const runHydeSearch = async (
    currentSuggestions: SuggestedNode[],
    currentNodeText: string,
    relationTriplets: [string, string, string][],
  ) => {
    if (
      !currentSuggestions.length ||
      !currentNodeText ||
      !relationTriplets.length
    ) {
      setHydeFilteredNodes([]);
      return;
    }

    setIsSearchingHyde(true);
    setHydeFilteredNodes([]);

    try {
      const candidateNodesWithEmbeddings: CandidateNodeWithEmbedding[] =
        currentSuggestions.map((node) => ({
          ...node,
          embedding: Array.from({ length: 5 }, () => Math.random()),
        }));

      const options = {
        hypotheticalNodeGenerator: generateHypotheticalNode,
        embeddingFunction: mockCreateEmbedding,
        searchFunction: mockVectorSearch,
      };

      const foundNodes: SuggestedNode[] = await findSimilarNodesUsingHyde(
        candidateNodesWithEmbeddings,
        currentNodeText,
        relationTriplets,
        options,
      );

      setHydeFilteredNodes(foundNodes);
    } catch (error) {
      console.error("Error during HyDE search:", error);
      setHydeFilteredNodes([]);
    } finally {
      setIsSearchingHyde(false);
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
                  Suggested Relationships (Ranked by HyDE)
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
                            onClick={() => handleCreateBlock(node.text)}
                            className="ml-2"
                          />
                        </li>
                      ))
                    : null}
                  {!isSearchingHyde && hydeFilteredNodes.length === 0 && (
                    <li>No relevant relations found using HyDE.</li>
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
