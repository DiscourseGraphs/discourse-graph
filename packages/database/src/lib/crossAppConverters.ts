import {
  CrossAppEmbedding,
  InlineCrossAppContent,
  CrossAppNode,
  CrossAppNodeSchema,
  CrossAppRelationTypeSchema,
  CrossAppRelationTripleSchema,
  CrossAppRelation,
} from "../crossAppContracts";
import { LocalContentDataInput, LocalConceptDataInput } from "../inputTypes";
import { Enums, type CompositeTypes, type Tables, type Json } from "../dbTypes";

type InlineEmbeddingInput = CompositeTypes<"inline_embedding_input">;
type Concept = Tables<"Concept">;

const crossAppEmbeddingToDbEmbedding = (
  embedding: CrossAppEmbedding | undefined,
): InlineEmbeddingInput | undefined =>
  embedding === undefined
    ? undefined
    : {
        vector: embedding.value,
        model: embedding.embedding || "openai_text_embedding_3_small_1536",
      };

const filterUndefined = <T extends Record<string, unknown>>(data: T): T => {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined),
  ) as T;
};

const filterUndefinedArray = <T>(data: (T | undefined)[]): T[] =>
  data.filter((v) => v !== undefined);

const inlineCrossAppContentToDbContent = (
  content: InlineCrossAppContent | undefined,
  variant: Enums<"ContentVariant">,
): LocalContentDataInput | undefined => {
  if (content === undefined) return undefined;
  return filterUndefined<LocalContentDataInput>({
    source_local_id: content.localId,
    text: content.value,
    scale: content.scale || "document",
    content_type: content.contentType || "text/plain",
    variant,
    created: content.createdAt?.toISOString(),
    last_modified: content.modifiedAt?.toISOString(),
    author_local_id: content.authorId,
    embedding_inline: crossAppEmbeddingToDbEmbedding(content.embedding),
  });
};

export const crossAppNodeToDbContent = (
  node: CrossAppNode | undefined,
  variant: "full" | "direct",
): LocalContentDataInput | undefined => {
  if (node === undefined) return undefined;
  const content = node.content[variant];
  if (content === undefined) return undefined;
  return inlineCrossAppContentToDbContent(
    {
      ...content,
      createdAt: content.createdAt || node.createdAt,
      modifiedAt: content.modifiedAt || node.modifiedAt,
      authorId: content.authorId || node.authorId,
    },
    variant,
  );
};

export const crossAppNodeToDbConcept = (
  node: CrossAppNode,
): LocalConceptDataInput => {
  return filterUndefined<LocalConceptDataInput>({
    source_local_id: node.localId,
    name: node.content.direct.value,
    author_local_id: node.authorId,
    schema_represented_by_local_id: node.nodeType,
    contents_inline: filterUndefinedArray([
      crossAppNodeToDbContent(node, "direct"),
      crossAppNodeToDbContent(node, "full"),
    ]),
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};

export const crossAppNodeSchemaToDbConcept = (
  node: CrossAppNodeSchema,
): LocalConceptDataInput => {
  const literalInfo = filterUndefined({
    template: node.templateTitle,
    template_content: node.template,
  });
  return filterUndefined<LocalConceptDataInput>({
    source_local_id: node.localId,
    name: node.label,
    author_local_id: node.authorId,
    is_schema: true,
    literal_content:
      Object.keys(literalInfo).length > 0 ? literalInfo : undefined,
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};

export const dbNodeSchemaToCrossApp = (
  schema: Concept,
  authorMap: Record<number, string>,
): CrossAppNodeSchema => {
  const { template, template_content, ...other } =
    schema.literal_content as Record<string, Json>;
  const authorId = authorMap[schema.author_id || 0];
  if (authorId === undefined) throw new Error("Missing author");
  return {
    localId: schema.source_local_id!,
    createdAt: new Date(schema.created + "Z"),
    modifiedAt: new Date(schema.last_modified + "Z"),
    label: schema.name,
    metadata: other,
    template: template_content as string | undefined,
    templateTitle: template as string | undefined,
    authorId,
  };
};

export const crossAppRelationTypeSchemaToDbConcept = (
  node: CrossAppRelationTypeSchema,
): LocalConceptDataInput => {
  return filterUndefined<LocalConceptDataInput>({
    source_local_id: node.localId,
    name: node.label,
    author_local_id: node.authorId,
    is_schema: true,
    literal_content: {
      roles: ["source", "destination"],
      label: node.label,
      complement: node.complement,
    },
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};

export const dbRelationTypeSchemaToCrossApp = (
  schema: Concept,
  authorMap: Record<number, string>,
): CrossAppRelationTypeSchema => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { roles, label, complement, ...other } =
    schema.literal_content as Record<string, Json>;
  const authorId = authorMap[schema.author_id || 0];
  if (authorId === undefined) throw new Error("Missing author");
  return {
    localId: schema.source_local_id!,
    createdAt: new Date(schema.created + "Z"),
    modifiedAt: new Date(schema.last_modified + "Z"),
    metadata: other,
    label: label as string,
    complement: complement as string,
    authorId,
  };
};

export const crossAppRelationTripleSchemaToDbConcept = ({
  node,
  sourceNodeSchema,
  destinationNodeSchema,
  relationType,
}: {
  node: CrossAppRelationTripleSchema;
  sourceNodeSchema: CrossAppNodeSchema;
  destinationNodeSchema: CrossAppNodeSchema;
  // used in Obsidian, not yet in Roam.
  relationType?: CrossAppRelationTypeSchema;
}): LocalConceptDataInput | undefined => {
  if (!("label" in node) && relationType === undefined) return undefined;
  const label = "label" in node ? node.label : relationType!.label;
  const complement =
    "complement" in node ? node.complement : relationType!.complement;
  return filterUndefined<LocalConceptDataInput>({
    source_local_id: node.localId,
    name: `${sourceNodeSchema.label} -${label}-> ${destinationNodeSchema.label}`,
    author_local_id: node.authorId,
    is_schema: true,
    literal_content: filterUndefined({
      roles: ["source", "destination"],
      label,
      complement,
    }),
    local_reference_content: {
      relation_type: node.relation,
      source: node.sourceType,
      destination: node.destinationType,
    },
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};

export const crossAppRelationToDbConcept = (
  node: CrossAppRelation,
): LocalConceptDataInput => {
  return filterUndefined<LocalConceptDataInput>({
    // use LocalIds... not ideal
    name: `${node.localId}: ${node.source} -${node.relationType}-> ${node.destination}`,
    source_local_id: node.localId,
    author_local_id: node.authorId,
    schema_represented_by_local_id: node.relationType,
    local_reference_content: {
      source: node.source,
      destination: node.destination,
    },
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};
