import { parseLinktext, TFile } from "obsidian";
import type DiscourseGraphPlugin from "~/index";
import type { DiscourseNode } from "~/types";
import { getNodeTypeById, getRelationTypeById } from "./typeUtils";
import {
  countDisplayableRelations,
  getEndpointIdsFromFrontmatter,
  getNodeTypeIdFromFrontmatter,
} from "./discourseLinkFrontmatter";

export type DiscourseLinkTarget = {
  file: TFile;
  nodeType: DiscourseNode;
  relationCount: number;
};

/**
 * Resolves a link to a discourse node and its relation count from in-memory
 * caches only; avoids getNodeTypeIdForFile, which polls 500ms for frontmatter.
 */
export const resolveDiscourseLinkTarget = ({
  plugin,
  linktext,
  sourcePath,
}: {
  plugin: DiscourseGraphPlugin;
  linktext: string;
  sourcePath: string;
}): DiscourseLinkTarget | null => {
  // Strips any #heading or #^block subpath.
  const { path } = parseLinktext(linktext);
  if (!path) return null;

  const file = plugin.app.metadataCache.getFirstLinkpathDest(path, sourcePath);
  if (!file) return null;

  const frontmatter = plugin.app.metadataCache.getFileCache(file)?.frontmatter;

  const nodeTypeId = getNodeTypeIdFromFrontmatter(frontmatter);
  if (!nodeTypeId) return null;

  const nodeType = getNodeTypeById(plugin, nodeTypeId);
  if (!nodeType) return null;

  const endpointIds = getEndpointIdsFromFrontmatter(frontmatter);
  if (endpointIds.length === 0) return { file, nodeType, relationCount: 0 };

  const relations =
    plugin.relationsIndex.getRelationsForEndpointIds(endpointIds);

  const relationCount = countDisplayableRelations({
    relations,
    isConfiguredType: (relationTypeId) =>
      !!getRelationTypeById(plugin, relationTypeId),
  });

  return { file, nodeType, relationCount };
};
