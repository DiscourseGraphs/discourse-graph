import type { RelationInstance } from "~/types";

/**
 * Pure frontmatter/relation helpers behind discourseLinkUtils, kept free of
 * Obsidian imports so they stay directly testable.
 */

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const getNodeTypeIdFromFrontmatter = (
  frontmatter: Record<string, unknown> | undefined,
): string | undefined => asString(frontmatter?.nodeTypeId);

/**
 * The ids a file's relations can be filed under.
 *
 * An imported node is referenced by its local nodeInstanceId and, in relations
 * that arrived with the import, by its importedFromRid — so both must be
 * queried for its relations to be found.
 */
export const getEndpointIdsFromFrontmatter = (
  frontmatter: Record<string, unknown> | undefined,
): string[] => {
  const endpointIds: string[] = [];
  const nodeInstanceId = asString(frontmatter?.nodeInstanceId);
  const importedFromRid = asString(frontmatter?.importedFromRid);

  if (nodeInstanceId) endpointIds.push(nodeInstanceId);
  if (importedFromRid && importedFromRid !== nodeInstanceId) {
    endpointIds.push(importedFromRid);
  }

  return endpointIds;
};

/**
 * Counts relations that are actually part of the graph.
 *
 * `tentative === false` marks an imported relation the user has not accepted
 * yet; the Discourse Context panel lists those separately from accepted ones,
 * so counting them in the badge would show a number the panel never repeats
 * back. Local relations leave `tentative` undefined.
 */
export const countAcceptedRelations = (relations: RelationInstance[]): number =>
  relations.filter((relation) => relation.tentative !== false).length;
