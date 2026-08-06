import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";

/**
 * Shared matching primitives for the two schema import paths: importing from a
 * remote Supabase space, and importing from an exported schema file. Both need
 * to answer "does this incoming type already exist locally?" the same way, or
 * the same vault reached through the two paths would dedupe differently.
 */

/**
 * Maps every id in the schema file to the local id it resolves to. The
 * `existing*` sets are schema-file ids that will NOT be created — either
 * because they already exist in the vault, or because they collapsed onto an
 * earlier item in the same file. Callers should resolve references through the
 * id mappings rather than assuming a schema id survives the import.
 *
 * Lives here rather than beside the import apply logic so that both the apply
 * path and the field-diff path can depend on it without a circular import.
 */
export type SchemaImportMatchPlan = {
  nodeTypeIdMapping: Map<string, string>;
  relationTypeIdMapping: Map<string, string>;
  existingNodeTypeIds: Set<string>;
  existingRelationTypeIds: Set<string>;
  existingDiscourseRelationIds: Set<string>;
  existingTemplateNames: Set<string>;
  localTemplateNames: Set<string>;
};

export const normalizeSchemaLabel = (value: string): string => {
  return value.trim().toLowerCase();
};

/**
 * Match by id first: an id collision means the type came from the same origin,
 * which is stronger evidence than a name that two vaults happen to share.
 */
export const findLocalNodeTypeMatch = ({
  localNodeTypes,
  id,
  name,
}: {
  localNodeTypes: DiscourseNode[];
  id: string;
  name: string;
}): DiscourseNode | undefined => {
  const matchById = localNodeTypes.find((nodeType) => nodeType.id === id);
  if (matchById) return matchById;

  const normalizedName = normalizeSchemaLabel(name);
  return localNodeTypes.find(
    (nodeType) => normalizeSchemaLabel(nodeType.name) === normalizedName,
  );
};

export const findLocalRelationTypeMatch = ({
  localRelationTypes,
  id,
  label,
}: {
  localRelationTypes: DiscourseRelationType[];
  id: string;
  label: string;
}): DiscourseRelationType | undefined => {
  const matchById = localRelationTypes.find(
    (relationType) => relationType.id === id,
  );
  if (matchById) return matchById;

  const normalizedLabel = normalizeSchemaLabel(label);
  return localRelationTypes.find(
    (relationType) =>
      normalizeSchemaLabel(relationType.label) === normalizedLabel,
  );
};

/**
 * A discourse relation is identified by its endpoints and relation type, not by
 * its own id — the id is regenerated per vault, so two vaults describing the
 * same triple hold different ids for it.
 */
export const findExistingTriple = ({
  discourseRelations,
  sourceId,
  destinationId,
  relationshipTypeId,
}: {
  discourseRelations: DiscourseRelation[];
  sourceId: string;
  destinationId: string;
  relationshipTypeId: string;
}): DiscourseRelation | undefined => {
  return discourseRelations.find(
    (relation) =>
      relation.sourceId === sourceId &&
      relation.destinationId === destinationId &&
      relation.relationshipTypeId === relationshipTypeId,
  );
};

/** Pins the "schema" RID subtype so both import paths produce identical RIDs. */
export const buildSchemaRid = ({
  spaceUri,
  localId,
}: {
  spaceUri: string;
  localId: string;
}): string => {
  return spaceUriAndLocalIdToRid(spaceUri, localId, "schema");
};
