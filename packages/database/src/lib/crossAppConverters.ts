import {
  LocalRef,
  Ref,
  CrossAppEmbedding,
  InlineCrossAppContent,
  CrossAppBase,
  CrossAppNode,
} from "../crossAppContracts";
import { LocalContentDataInput } from "../inputTypes";
import { Enums, CompositeTypes } from "../dbTypes";

type InlineEmbeddingInput = CompositeTypes<"inline_embedding_input">;
type InlineAbstractBase = Partial<CrossAppBase>;

const decodeLocalRef = <LocalVarName extends string>(
  ref: LocalRef | InlineAbstractBase | undefined,
  localVarName: LocalVarName,
): Record<LocalVarName, string> | Record<string, never> => {
  if (ref === undefined) return {};
  if ("localId" in ref) {
    return {
      [localVarName]: ref.localId,
    } as Record<LocalVarName, string>;
  }
  return {};
};

const decodeRef = <DbVarName extends string, LocalVarName extends string>(
  ref: Ref | undefined,
  dbVarName: DbVarName,
  localVarName: LocalVarName,
):
  | Record<DbVarName, number>
  | Record<LocalVarName, string>
  | Record<string, never> => {
  if (ref === undefined) return {};
  if ("dbId" in ref)
    return { [dbVarName]: ref.dbId } as Record<DbVarName, number>;
  return decodeLocalRef(ref, localVarName);
};

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

const crossAppContentToDbContent = (
  content: InlineCrossAppContent | undefined,
  variant: Enums<"ContentVariant">,
  node?: CrossAppNode,
): LocalContentDataInput | undefined => {
  if (content === undefined) return undefined;
  return filterUndefined<LocalContentDataInput>({
    ...decodeLocalRef(content, "source_local_id"),
    text: content.value,
    scale: content.scale || "document",
    content_type: content.contentType || "text/plain",
    variant: variant,
    created: (content.createdAt || node?.createdAt)?.toISOString(),
    last_modified: (content.modifiedAt || node?.modifiedAt)?.toISOString(),
    ...decodeRef(
      content.author || node?.author,
      "author_id",
      "author_local_id",
    ),
    embedding_inline: crossAppEmbeddingToDbEmbedding(content.embedding),
  });
};

export const crossAppInlineContentToDbContent = (
  node: CrossAppNode | undefined,
  variant: "full" | "direct",
): LocalContentDataInput | undefined => {
  if (node === undefined) return undefined;
  const content = node.content[variant];
  return crossAppContentToDbContent(content, variant, node);
};
