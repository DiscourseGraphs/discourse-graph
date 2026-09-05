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
 * Resolves a link to a discourse node and its relation count, synchronously.
 *
 * Every read here hits an already-in-memory cache — Obsidian's metadataCache
 * for frontmatter, the plugin's settings for node types, and RelationsIndex for
 * relations — because this runs per link on a render path, once per viewport
 * update.
 *
 * Deliberately does not use getNodeTypeIdForFile/getNodeInstanceIdForFile: those
 * poll for up to 500ms waiting on frontmatter for a just-created file, which is
 * right for relation bookkeeping and wrong for rendering. If frontmatter is not
 * cached yet this returns null and the caller redraws when the index or the
 * metadata cache next reports a change.
 *
 * Returns null when the link does not resolve, the target is not a discourse
 * node, or its node type is no longer configured.
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
  // Strips any #heading or #^block subpath, which is not part of the file path.
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
