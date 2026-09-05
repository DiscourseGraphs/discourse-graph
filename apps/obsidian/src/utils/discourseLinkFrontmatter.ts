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
 * Counts the relations the Discourse Context panel would actually list.
 *
 * Two kinds are excluded, and both have to be, or the badge advertises context
 * the panel then refuses to show:
 *
 * - `tentative === false` marks an imported relation the user has not accepted
 *   yet, which the panel lists separately. Local relations leave it undefined.
 * - A relation whose type is no longer configured is orphaned — deleting a
 *   relation type leaves its relations behind in relations.json — and the panel
 *   silently drops those.
 */
export const countDisplayableRelations = ({
  relations,
  isConfiguredType,
}: {
  relations: RelationInstance[];
  isConfiguredType: (relationTypeId: string) => boolean;
}): number =>
  relations.filter(
    (relation) =>
      relation.tentative !== false && isConfiguredType(relation.type),
  ).length;
