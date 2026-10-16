type PairRelation = { id: string; source: string; destination: string };

export type RelationPairMatch<T> = {
  isDirect: boolean;
  isReverse: boolean;
  matchingRelation: T | null;
};

export const checkConnectionType = (
  relation: { source: string; destination: string },
  sourceNodeType: string,
  targetNodeType: string,
): { isDirect: boolean; isReverse: boolean } => ({
  isDirect:
    sourceNodeType === relation.source &&
    targetNodeType === relation.destination,
  isReverse:
    sourceNodeType === relation.destination &&
    targetNodeType === relation.source,
});

// Same-label triplets can connect one pair in both directions or with different
// complements; the arrow's own triplet wins so the save keeps its direction.
export const findRelationForPair = <T extends PairRelation>({
  relations,
  sourceNodeType,
  targetNodeType,
  preferredRelationId,
}: {
  relations: T[];
  sourceNodeType: string;
  targetNodeType: string;
  preferredRelationId?: string;
}): RelationPairMatch<T> => {
  const preferred = preferredRelationId
    ? relations.find((rel) => rel.id === preferredRelationId)
    : undefined;
  const candidates = preferred ? [preferred, ...relations] : relations;
  for (const rel of candidates) {
    const { isDirect, isReverse } = checkConnectionType(
      rel,
      sourceNodeType,
      targetNodeType,
    );
    if (isDirect || isReverse) {
      return { isDirect, isReverse, matchingRelation: rel };
    }
  }
  return { isDirect: false, isReverse: false, matchingRelation: null };
};
