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
 * Counts what the panel would list. Excludes unaccepted imports and relations
 * orphaned by a deleted relation type, both of which the panel hides.
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
