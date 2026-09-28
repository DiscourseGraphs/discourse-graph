import type { Editor, TLShape, TLShapeId, VecLike } from "tldraw";
import type { DiscourseNodeShape } from "~/components/canvas/shapes/DiscourseNodeShape";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseRelation, DiscourseRelationType } from "~/types";
import generateUid from "~/utils/generateUid";
import { COLOR_PALETTE } from "~/utils/tldrawColors";
import { isAcceptedSchema } from "~/utils/typeUtils";

export const isDiscourseNodeShape = (
  shape: TLShape | null | undefined,
): shape is DiscourseNodeShape => shape?.type === "discourse-node";

/**
 * Finds the discourse node shape at a given page point, excluding an optional
 * shape by ID (e.g. the source node or the relation arrow itself).
 */
export const getDiscourseNodeAtPoint = (
  editor: Editor,
  point: VecLike,
  excludeShapeId?: TLShapeId,
): TLShape | undefined => {
  return editor.getShapeAtPoint(point, {
    hitInside: true,
    hitFrameInside: true,
    margin: 0,
    filter: (targetShape) =>
      targetShape.type === "discourse-node" &&
      !targetShape.isLocked &&
      targetShape.id !== excludeShapeId,
  });
};

/**
 * Extracts the nodeTypeId from any tldraw shape that may have it.
 * Avoids repeating the same unsafe cast across multiple files.
 */
export const getDiscourseNodeTypeId = (shape: unknown): string | undefined => {
  const typed = shape as { props?: { nodeTypeId?: string } } | null | undefined;
  return typed?.props?.nodeTypeId;
};

type RelationTypeSettings = {
  discourseRelations: DiscourseRelation[];
  relationTypes: DiscourseRelationType[];
};

/**
 * Checks the direction of a discourse relation between two node types.
 * Returns whether the relation exists in the direct (source→target)
 * and/or reverse (target→source) direction.
 */
export const getRelationDirection = ({
  discourseRelations,
  relationTypeId,
  sourceNodeTypeId,
  targetNodeTypeId,
}: {
  discourseRelations: DiscourseRelation[];
  relationTypeId: string;
  sourceNodeTypeId: string;
  targetNodeTypeId: string;
}): { direct: boolean; reverse: boolean } => {
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

export const getRelationLabelForDirection = ({
  discourseRelations,
  relationType,
  sourceNodeTypeId,
  targetNodeTypeId,
}: {
  discourseRelations: DiscourseRelation[];
  relationType: DiscourseRelationType;
  sourceNodeTypeId: string;
  targetNodeTypeId: string;
}): string => {
  const { direct, reverse } = getRelationDirection({
    discourseRelations,
    relationTypeId: relationType.id,
    sourceNodeTypeId,
    targetNodeTypeId,
  });

  if (reverse && !direct) {
    return relationType.complement;
  }

  return relationType.label;
};

/**
 * Returns the list of valid relation types for a given pair of node types,
 * checking both directions of the discourse relations.
 */
export const getValidRelationTypesForNodePair = ({
  settings,
  sourceNodeTypeId,
  targetNodeTypeId,
}: {
  settings: RelationTypeSettings;
  sourceNodeTypeId: string;
  targetNodeTypeId: string;
}): { id: string; label: string; color: string }[] => {
  const validTypes: { id: string; label: string; color: string }[] = [];

  for (const relationType of settings.relationTypes) {
    const { direct, reverse } = getRelationDirection({
      discourseRelations: settings.discourseRelations,
      relationTypeId: relationType.id,
      sourceNodeTypeId,
      targetNodeTypeId,
    });

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
 * Returns the accepted relation types not yet valid for a node pair in either
 * direction, which the "Add existing" picker offers.
 */
export const getAssociableRelationTypesForNodePair = ({
  settings,
  sourceNodeTypeId,
  targetNodeTypeId,
}: {
  settings: RelationTypeSettings;
  sourceNodeTypeId: string;
  targetNodeTypeId: string;
}): DiscourseRelationType[] =>
  settings.relationTypes.filter((relationType) => {
    if (!isAcceptedSchema(relationType)) return false;
    const { direct, reverse } = getRelationDirection({
      discourseRelations: settings.discourseRelations,
      relationTypeId: relationType.id,
      sourceNodeTypeId,
      targetNodeTypeId,
    });
    return !direct && !reverse;
  });

/**
 * Makes a relation type valid for a source → target node pair and saves it.
 * Removes the added relation again if the save fails.
 */
export const associateRelationTypeWithNodePair = async ({
  plugin,
  relationTypeId,
  sourceNodeTypeId,
  targetNodeTypeId,
}: {
  plugin: DiscourseGraphPlugin;
  relationTypeId: string;
  sourceNodeTypeId: string;
  targetNodeTypeId: string;
}): Promise<void> => {
  const now = Date.now();
  const relation: DiscourseRelation = {
    id: generateUid("rel3"),
    sourceId: sourceNodeTypeId,
    destinationId: targetNodeTypeId,
    relationshipTypeId: relationTypeId,
    created: now,
    modified: now,
  };
  plugin.settings.discourseRelations = [
    ...plugin.settings.discourseRelations,
    relation,
  ];
  try {
    await plugin.saveSettings();
  } catch (error) {
    // Filter by id: another association may have saved while this one was pending
    plugin.settings.discourseRelations =
      plugin.settings.discourseRelations.filter(({ id }) => id !== relation.id);
    throw error;
  }
};

/**
 * Checks whether a specific relation type can connect the given source and
 * target node types (in either direction).
 */
export const isValidRelationConnection = ({
  discourseRelations,
  relationTypeId,
  sourceNodeTypeId,
  targetNodeTypeId,
}: {
  discourseRelations: DiscourseRelation[];
  relationTypeId: string;
  sourceNodeTypeId: string;
  targetNodeTypeId: string;
}): boolean => {
  const { direct, reverse } = getRelationDirection({
    discourseRelations,
    relationTypeId,
    sourceNodeTypeId,
    targetNodeTypeId,
  });
  return direct || reverse;
};

/**
 * Returns the valid target node type IDs for a given relation type and source
 * node type, checking both forward and reverse directions.
 */
export const getCompatibleTargetNodeTypeIds = ({
  discourseRelations,
  relationTypeId,
  sourceNodeTypeId,
}: {
  discourseRelations: DiscourseRelation[];
  relationTypeId: string;
  sourceNodeTypeId: string;
}): string[] => {
  const targets = new Set<string>();
  for (const relation of discourseRelations) {
    if (relation.relationshipTypeId !== relationTypeId) continue;
    if (relation.sourceId === sourceNodeTypeId)
      targets.add(relation.destinationId);
    if (relation.destinationId === sourceNodeTypeId)
      targets.add(relation.sourceId);
  }
  return [...targets];
};
