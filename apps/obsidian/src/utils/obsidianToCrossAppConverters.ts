import type {
  CrossAppNodeSchema,
  CrossAppRelationTripleSchema,
  CrossAppRelationTypeSchema,
} from "@repo/database/crossAppContracts";
import type {
  DiscourseNode,
  DiscourseRelation,
  DiscourseRelationType,
} from "~/types";

export const nodeTypeToCrossApp = ({
  nodeType,
  templateContent,
  accountLocalId,
}: {
  nodeType: Pick<
    DiscourseNode,
    "id" | "name" | "format" | "template" | "created" | "modified"
  >;
  templateContent?: string;
  accountLocalId: string;
}): CrossAppNodeSchema => ({
  localId: nodeType.id,
  label: nodeType.name,
  format: nodeType.format,
  templateTitle: nodeType.template || undefined,
  template: templateContent || undefined,
  authorId: accountLocalId,
  createdAt: new Date(nodeType.created),
  modifiedAt: new Date(nodeType.modified),
});

export const relationTypeToCrossApp = ({
  relationType,
  accountLocalId,
}: {
  relationType: Pick<
    DiscourseRelationType,
    "id" | "label" | "complement" | "created" | "modified"
  >;
  accountLocalId: string;
}): CrossAppRelationTypeSchema => ({
  localId: relationType.id,
  label: relationType.label,
  complement: relationType.complement,
  authorId: accountLocalId,
  createdAt: new Date(relationType.created),
  modifiedAt: new Date(relationType.modified),
});

export const relationTripleToCrossApp = ({
  relation,
  accountLocalId,
}: {
  relation: DiscourseRelation;
  accountLocalId: string;
}): CrossAppRelationTripleSchema => ({
  localId: relation.id,
  relation: relation.relationshipTypeId,
  sourceType: relation.sourceId,
  destinationType: relation.destinationId,
  authorId: accountLocalId,
  createdAt: new Date(relation.created),
  modifiedAt: new Date(relation.modified),
});
