import type DiscourseGraphPlugin from "~/index";
import { DiscourseNode } from "~/types";

export const getNodeTypeById = (
  plugin: DiscourseGraphPlugin,
  nodeTypeId: string,
): DiscourseNode | undefined => {
  return plugin.settings.nodeTypes.find((node) => node.id === nodeTypeId);
};