import type { DiscourseRelation, DiscourseRelationType } from "~/types";
import { COLOR_PALETTE } from "~/utils/tldrawColors";

type RelationTypeSettings = {
  discourseRelations: DiscourseRelation[];
  relationTypes: DiscourseRelationType[];
};

/**
 * Checks the direction of a discourse relation between two node types.
 * Returns whether the relation exists in the direct (source→target)
 * and/or reverse (target→source) direction.
 */
export const getRelationDirection = (
  discourseRelations: DiscourseRelation[],
  relationTypeId: string,
  sourceNodeTypeId: string,
  targetNodeTypeId: string,
): { direct: boolean; reverse: boolean } => {
  let direct = false;
  let reverse = false;

  for (const relation of discourseRelations) {
    if (relation.relationshipTypeId !== relationTypeId) continue;
    if (
      relation.sourceId === sourceNodeTypeId &&
      relation.destinationId === targetNodeTypeId
    ) {
      direct = true;
    }
    if (
      relation.sourceId === targetNodeTypeId &&
      relation.destinationId === sourceNodeTypeId
    ) {
      reverse = true;
    }
    if (direct && reverse) break;
  }

  return { direct, reverse };
};

/**
 * Returns the list of valid relation types for a given pair of node types,
 * checking both directions of the discourse relations.
 */
export const getValidRelationTypesForNodePair = (
  settings: RelationTypeSettings,
  sourceNodeTypeId: string,
  targetNodeTypeId: string,
): { id: string; label: string; color: string }[] => {
  const validTypes: { id: string; label: string; color: string }[] = [];

  for (const relationType of settings.relationTypes) {
    const { direct, reverse } = getRelationDirection(
      settings.discourseRelations,
      relationType.id,
      sourceNodeTypeId,
      targetNodeTypeId,
    );

    if (direct || reverse) {
      validTypes.push({
        id: relationType.id,
        label: relationType.label,
        color: COLOR_PALETTE[relationType.color] ?? COLOR_PALETTE["black"]!,
      });
    }
  }

  return validTypes;
};

/**
 * Checks whether any valid relation type exists between two node types.
 */
export const hasValidRelationTypeForNodePair = (
  settings: RelationTypeSettings,
  sourceNodeTypeId: string,
  targetNodeTypeId: string,
): boolean => {
  return settings.discourseRelations.some(
    (r) =>
      settings.relationTypes.some((rt) => rt.id === r.relationshipTypeId) &&
      ((r.sourceId === sourceNodeTypeId &&
        r.destinationId === targetNodeTypeId) ||
        (r.sourceId === targetNodeTypeId &&
          r.destinationId === sourceNodeTypeId)),
  );
};
