import getDiscourseContextResults from "./getDiscourseContextResults";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import findDiscourseNode from "./findDiscourseNode";
import getDiscourseRelations from "./getDiscourseRelations";
import getDiscourseNodes from "./getDiscourseNodes";
import { useCallback, useEffect, useMemo, useState } from "react";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import { type RelationDetails } from "./hyde";

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

export const useDiscourseNodeFilters = (tag: string) => {
  const [results, setResults] = useState<DiscourseData["results"]>([]);

  const tagUid = useMemo(() => getPageUidByPageTitle(tag), [tag]);
  const discourseNode = useMemo(() => findDiscourseNode(tagUid), [tagUid]);
  const relations = useMemo(() => getDiscourseRelations(), []);
  const allNodes = useMemo(() => getDiscourseNodes(), []);

  const getInfo = useCallback(
    () =>
      getOverlayInfo(tag, relations)
        .then(({ results }) => {
          setResults(results);
        })
        .finally(() => {}),
    [tag, relations],
  );

  useEffect(() => {
    void getInfo();
  }, [getInfo]);

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
    const uniqueTriplets = new Map<string, RelationDetails>();

    validRelations.forEach((relation) => {
      const isSelfSource = relation.source === relatedNodeType;
      const isSelfDestination = relation.destination === relatedNodeType;

      if (isSelfSource) {
        const targetNodeType = relation.destination;
        const identifiedTargetNode = allNodes.find(
          (node) => node.type === targetNodeType,
        );

        if (identifiedTargetNode) {
          const key = `${relation.label}-${identifiedTargetNode.text}`;
          uniqueTriplets.set(key, {
            relationLabel: relation.label,
            relatedNodeText: identifiedTargetNode.text,
            relatedNodeFormat: identifiedTargetNode.format,
          });
        }
      }

      if (isSelfDestination) {
        const targetNodeType = relation.source;
        const identifiedTargetNode = allNodes.find(
          (node) => node.type === targetNodeType,
        );

        if (identifiedTargetNode) {
          const key = `${relation.complement}-${identifiedTargetNode.text}`;
          uniqueTriplets.set(key, {
            relationLabel: relation.complement,
            relatedNodeText: identifiedTargetNode.text,
            relatedNodeFormat: identifiedTargetNode.format,
          });
        }
      }
    });

    return Array.from(uniqueTriplets.values());
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

  return {
    results,
    discourseNode,
    allNodes,
    uniqueRelationTypeTriplets,
    validTypes,
  };
};
