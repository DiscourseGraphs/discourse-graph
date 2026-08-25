/** Shared by both import paths (Supabase space and schema file) so the same vault dedupes identically either way. */
import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";

/** `existing*` hold schema-file ids that will not be created; resolve references through the id mappings, as a schema id may not survive the import. */
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

/** Match by id first: an id collision is stronger evidence than a name two vaults happen to share. */
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

/** A triple is identified by its endpoints and relation type, not its id — ids are regenerated per vault. */
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
