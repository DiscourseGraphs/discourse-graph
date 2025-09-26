import type DiscourseGraphPlugin from "~/index";
import { DiscourseNode, DiscourseRelationType } from "~/types";

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