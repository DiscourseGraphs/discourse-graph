import {
  CrossAppEmbedding,
  InlineCrossAppContent,
  CrossAppNode,
} from "../crossAppContracts";
import { LocalContentDataInput, LocalConceptDataInput } from "../inputTypes";
import { Enums, CompositeTypes } from "../dbTypes";

type InlineEmbeddingInput = CompositeTypes<"inline_embedding_input">;

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
