import type { RelationInstance } from "~/types";

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

export const getNodeTypeIdFromFrontmatter = (
  frontmatter: Record<string, unknown> | undefined,
): string | undefined => asString(frontmatter?.nodeTypeId);

/** An imported node is referenced by both its nodeInstanceId and its importedFromRid. */
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
 * Excludes unaccepted imports and relations orphaned by a deleted relation
 * type, both of which the panel hides. Does not check that the peer endpoint
 * still resolves to a file, so a deleted peer over-counts by one: resolving a
 * peer is a vault scan, which callers on a render path cannot afford.
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
