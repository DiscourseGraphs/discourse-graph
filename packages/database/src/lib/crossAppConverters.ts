import {
  LocalRef,
  Ref,
  CrossAppEmbedding,
  InlineCrossAppContent,
  StandaloneCrossAppContent,
  CrossAppBase,
  CrossAppNode,
} from "../crossAppContracts";
import { LocalContentDataInput, LocalConceptDataInput } from "../inputTypes";
import { Enums, CompositeTypes } from "../dbTypes";

type ContentDataInput = CompositeTypes<"content_local_input">;
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

const decodeRefWithNulls = <
  DbVarName extends string,
  LocalVarName extends string,
>(
  ref: Ref | undefined,
  dbVarName: DbVarName,
  localVarName: LocalVarName,
): Record<DbVarName, number | null> & Record<LocalVarName, string | null> => {
  return {
    [dbVarName]: ref && "dbId" in ref ? ref.dbId : null,
    [localVarName]: ref && "localId" in ref ? ref.localId : null,
  } as Record<DbVarName, number | null> & Record<LocalVarName, string | null>;
};

const decodeRefWithInlineNulls = <
  DbVarName extends string,
  LocalVarName extends string,
  InlineVarName extends string,
>({
  ref,
  dbVarName,
  localVarName,
  inlineVarName,
}: {
  ref?: Ref;
  dbVarName: DbVarName;
  localVarName: LocalVarName;
  inlineVarName: InlineVarName;
}): Record<DbVarName, number | null> &
  Record<LocalVarName, string | null> &
  Record<InlineVarName, null> => {
  return {
    [dbVarName]: null,
    [localVarName]: null,
    [inlineVarName]: null,
    ...decodeRef(ref, dbVarName, localVarName),
  } as Record<DbVarName, number | null> &
    Record<LocalVarName, string | null> &
    Record<InlineVarName, null>;
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

const filterUndefinedArray = <T>(data: (T | undefined)[]): T[] =>
  data.filter((v) => v !== undefined);

const inlineCrossAppContentToDbContent = (
  content: InlineCrossAppContent | undefined,
  variant: Enums<"ContentVariant">,
): LocalContentDataInput | undefined => {
  if (content === undefined) return undefined;
  return filterUndefined<LocalContentDataInput>({
    ...decodeLocalRef(content, "source_local_id"),
    text: content.value,
    scale: content.scale || "document",
    content_type: content.contentType || "text/plain",
    variant,
    created: content.createdAt?.toISOString(),
    last_modified: content.modifiedAt?.toISOString(),
    ...decodeRef(content.author, "author_id", "author_local_id"),
    embedding_inline: crossAppEmbeddingToDbEmbedding(content.embedding),
  });
};

export const crossAppStandaloneContentToDbContent = (
  content: StandaloneCrossAppContent | undefined,
  space: Ref,
): ContentDataInput | undefined => {
  if (content === undefined) return undefined;
  return {
    source_local_id: content.localId,
    text: content.value,
    scale: content.scale || "document",
    content_type: content.contentType || "text/plain",
    variant: content.variant,
    created: content.createdAt.toISOString(),
    last_modified: (content.modifiedAt || content.createdAt).toISOString(),
    embedding_inline: crossAppEmbeddingToDbEmbedding(content.embedding) || null,
    ...decodeRefWithInlineNulls({
      ref: content.author,
      dbVarName: "author_id",
      localVarName: "author_local_id",
      inlineVarName: "author_inline",
    }),
    ...decodeRefWithNulls(space, "space_id", "space_url"),
    // provide other explicit null values for type completion
    ...decodeRefWithInlineNulls({
      dbVarName: "creator_id",
      localVarName: "creator_local_id",
      inlineVarName: "creator_inline",
    }),
    ...decodeRefWithInlineNulls({
      dbVarName: "document_id",
      localVarName: "document_local_id",
      inlineVarName: "document_inline",
    }),
    ...decodeRefWithNulls(undefined, "part_of_id", "part_of_local_id"),
    metadata: null,
  };
};

export const crossAppNodeToDbContent = (
  node: CrossAppNode | undefined,
  variant: "full" | "direct",
): LocalContentDataInput | undefined => {
  if (node === undefined) return undefined;
  const content = node.content[variant];
  return inlineCrossAppContentToDbContent(
    {
      ...content,
      createdAt: content.createdAt || node.createdAt,
      modifiedAt: content.modifiedAt || node.modifiedAt,
      author: content.author || node.author,
    },
    variant,
  );
};

export const crossAppNodeToDbConcept = (
  node: CrossAppNode,
): LocalConceptDataInput => {
  return filterUndefined<LocalConceptDataInput>({
    ...decodeLocalRef(node, "source_local_id"),
    name: node.content.direct.value,
    ...decodeRef(node.author, "author_id", "author_local_id"),
    ...decodeRef(node.nodeType, "schema_id", "schema_represented_by_local_id"),
    contents_inline: filterUndefinedArray([
      crossAppNodeToDbContent(node, "direct"),
      crossAppNodeToDbContent(node, "full"),
    ]),
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};
