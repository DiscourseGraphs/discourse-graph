import type DiscourseGraphPlugin from "~/index";
import { DiscourseNode, DiscourseRelation, DiscourseRelationType } from "~/types";

export const getNodeTypeById = (
  plugin: DiscourseGraphPlugin,
  nodeTypeId: string,
): DiscourseNode | undefined => {
  return plugin.settings.nodeTypes.find((node) => node.id === nodeTypeId);
};

export const getRelationTypeById = (
  plugin: DiscourseGraphPlugin,
  relationTypeId: string,
): DiscourseRelationType | undefined => {
  return plugin.settings.relationTypes.find(
    (relation) => relation.id === relationTypeId,
  );
};

export const getRelationById = (
  plugin: DiscourseGraphPlugin,
  relationId: string,
): DiscourseRelation | undefined => {
  return plugin.settings.discourseRelations.find(
    (relation) => relation.id === relationId,
  );
};

/**
 * Finds a relation triplet (DiscourseRelation) by matching source node type, destination node type, and relation type.
 * Returns the relation triplet id if found, otherwise undefined.
 */
export const findRelationTripletId = (
  plugin: DiscourseGraphPlugin,
  sourceNodeTypeId: string,
  destinationNodeTypeId: string,
  relationTypeId: string,
): string | undefined => {
  const relation = plugin.settings.discourseRelations.find(
    (rel) =>
      rel.sourceId === sourceNodeTypeId &&
      rel.destinationId === destinationNodeTypeId &&
      rel.relationshipTypeId === relationTypeId,
  );
  return relation?.id;
};