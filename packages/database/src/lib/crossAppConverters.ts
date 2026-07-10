import {
  LocalRef,
  Ref,
  CrossAppBase,
  //  InlineAbstractBase,
  InlineCrossAppDocument,
  CrossAppNodeSchema,
  CrossAppRelationTypeSchema,
  CrossAppRelationTripleSchema,
  CrossAppEmbedding,
  InlineCrossAppContent,
  CrossAppAccount,
  CrossAppNode,
  CrossAppRelation,
  LocalOrRemoteRef,
} from "../crossAppContracts";
import { spaceUriAndLocalIdToRid, ridToSpaceUriAndLocalId } from "./rid";
import {
  LocalAccountDataInput,
  LocalDocumentDataInput,
  LocalContentDataInput,
  LocalConceptDataInput,
} from "../inputTypes";
import { Enums, CompositeTypes } from "../dbTypes";

type InlineEmbeddingInput = CompositeTypes<"inline_embedding_input">;
type InlineAbstractBase = Partial<CrossAppBase>;

export const crossAppAccountToDbAccount = (
  node: CrossAppAccount,
): LocalAccountDataInput => ({
  name: node.name,
  account_local_id: node.accountLocalId,
  email: node.email,
});

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

const decodeLocalOrRemoteRef = <
  LocalVarName extends string,
  DbVarName extends string,
>({
  ref,
  dbVarName,
  localVarName,
  currentSpaceUri,
}: {
  ref: LocalOrRemoteRef | InlineAbstractBase | undefined;
  dbVarName: DbVarName;
  localVarName: LocalVarName;
  currentSpaceUri: string;
}):
  | Record<LocalVarName, string>
  | Record<DbVarName, number>
  | Record<string, never> => {
  if (ref === undefined) return {};
  if ("dbId" in ref)
    return { [dbVarName]: ref.dbId } as Record<DbVarName, number>;
  if ("rid" in ref) {
    const { sourceLocalId, spaceUri } = ridToSpaceUriAndLocalId(ref.rid);
    if (spaceUri === currentSpaceUri)
      return {
        [localVarName]: sourceLocalId,
      } as Record<LocalVarName, string>;
    return {
      [localVarName]: ref.rid,
    } as Record<LocalVarName, string>;
  }
  if ("space" in ref && ref.space !== undefined) {
    if ("dbId" in ref.space) {
      // not sure how to handle this
      return {
        [localVarName]: ref.localId,
      } as Record<LocalVarName, string>;
    }
    if ("url" in ref.space) {
      if (ref.space.url === currentSpaceUri) {
        return {
          [localVarName]: ref.localId,
        } as Record<LocalVarName, string>;
      } else
        return {
          [localVarName]: spaceUriAndLocalIdToRid(ref.space.url, ref.localId),
        } as Record<LocalVarName, string>;
    }
  }
  if ("localId" in ref) {
    return {
      [localVarName]: ref.localId,
    } as Record<LocalVarName, string>;
  }
  return {};
};

const decodeRefOrInline = <
  InlineType extends object,
  DbType extends object,
  DbVarName extends string,
  LocalVarName extends string,
  InlineVarName extends string,
>({
  data,
  dbVarName,
  localVarName,
  inlineVarName,
  encoder,
}: {
  data: InlineType | Ref | undefined;
  dbVarName: DbVarName;
  localVarName: LocalVarName;
  inlineVarName: InlineVarName;
  encoder: (inlineData: InlineType) => DbType;
}):
  | Record<DbVarName, number>
  | Record<LocalVarName, string>
  | Record<InlineVarName, DbType>
  | Record<string, never> => {
  if (data === undefined) return {};
  if (Object.keys(data).length === 0) return {};
  const ref = data as Ref;
  if ("dbId" in ref) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dbId, ...extraData } = ref;
    if (Object.keys(extraData).length === 0)
      return decodeRef(ref, dbVarName, localVarName);
  }
  if ("localId" in ref) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { localId, ...extraData } = ref;
    if (Object.keys(extraData).length === ("space" in ref ? 1 : 0))
      return decodeRef(ref, dbVarName, localVarName);
  }
  // assume not a simple ref
  return {
    [inlineVarName]: encoder(data as InlineType),
  } as Record<InlineVarName, DbType>;
};

export const crossAppDocumentToDbDocument = (
  document: InlineCrossAppDocument,
): LocalDocumentDataInput => {
  return {
    ...decodeLocalRef(document, "source_local_id"),
    ...decodeRefOrInline({
      data: document.author,
      dbVarName: "author_id",
      localVarName: "author_local_id",
      inlineVarName: "author_inline",
      encoder: crossAppAccountToDbAccount,
    }),
    created: document.createdAt?.toISOString(),
    last_modified: document.modifiedAt?.toISOString(),
    content_type: document.contentType,
  };
};

export const crossAppEmbeddingToDbEmbedding = (
  embedding: CrossAppEmbedding | undefined,
): InlineEmbeddingInput | undefined =>
  embedding === undefined
    ? undefined
    : {
        vector: embedding.value,
        model: embedding.embedding || "openai_text_embedding_3_small_1536",
      };

export const crossAppContentToDbContent = (
  content: InlineCrossAppContent | undefined,
  variant: Enums<"ContentVariant">,
  node?: CrossAppNode,
): LocalContentDataInput | undefined => {
  if (content === undefined) return undefined;
  return filterUndefined<LocalContentDataInput>({
    ...decodeLocalRef(content, "source_local_id"),
    text: content.value,
    scale: content.scale || "document",
    content_type:
      content.contentType ||
      (variant === "full" ? document?.contentType : undefined) ||
      "text/plain",
    variant: variant,
    created: (content.createdAt || node?.createdAt)?.toISOString(),
    last_modified: (content.modifiedAt || node?.modifiedAt)?.toISOString(),
    ...decodeRefOrInline({
      data: content.author || node?.author,
      dbVarName: "author_id",
      localVarName: "author_local_id",
      inlineVarName: "author_inline",
      encoder: crossAppAccountToDbAccount,
    }),
    ...decodeRef(content.partOf, "part_of_id", "part_of_local_id"),
    ...decodeRefOrInline({
      data: content.document || node?.document,
      dbVarName: "document_id",
      localVarName: "document_local_id",
      inlineVarName: "document_inline",
      encoder: crossAppDocumentToDbDocument,
    }),
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
    ...decodeRefOrInline({
      data: node.author,
      dbVarName: "author_id",
      localVarName: "author_local_id",
      inlineVarName: "author_inline",
      encoder: crossAppAccountToDbAccount,
    }),
    contents_inline: filterUndefinedArray([
      crossAppNodeToDbContent(node, "direct"),
      crossAppNodeToDbContent(node, "full"),
    ]),
    ...decodeRef(node.nodeType, "schema_id", "schema_represented_by_local_id"),
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};

export const crossAppNodeSchemaToDbConcept = (
  node: CrossAppNodeSchema,
): LocalConceptDataInput => {
  const literalInfo = filterUndefined({
    template: node.templateTitle,
    templateContent: node.template,
  });
  return filterUndefined<LocalConceptDataInput>({
    ...decodeLocalRef(node, "source_local_id"),
    name: node.label,
    ...decodeRefOrInline({
      data: node.author,
      dbVarName: "author_id",
      localVarName: "author_local_id",
      inlineVarName: "author_inline",
      encoder: crossAppAccountToDbAccount,
    }),
    is_schema: true,
    literal_content:
      Object.keys(literalInfo).length > 0 ? literalInfo : undefined,
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};

export const crossAppRelationTypeSchemaToDbConcept = (
  node: CrossAppRelationTypeSchema,
): LocalConceptDataInput => {
  return filterUndefined<LocalConceptDataInput>({
    ...decodeLocalRef(node, "source_local_id"),
    name: node.label,
    ...decodeRefOrInline({
      data: node.author,
      dbVarName: "author_id",
      localVarName: "author_local_id",
      inlineVarName: "author_inline",
      encoder: crossAppAccountToDbAccount,
    }),
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

export const crossAppRelationTripleSchemaToDbConcept = (
  node: CrossAppRelationTripleSchema,
): LocalConceptDataInput => {
  const relDataRaw = {
    ...decodeRefOrInline({
      data: node.relation,
      dbVarName: "relation",
      localVarName: "relation_local_id",
      inlineVarName: "relation_inline",
      encoder: crossAppRelationTypeSchemaToDbConcept,
    }),
    ...decodeRef(node.sourceType, "source", "source_local_id"),
    ...decodeRef(node.destinationType, "destination", "destination_local_id"),
  };
  let relData: Omit<typeof relDataRaw, "relation_inline"> & {
    relationInline?: LocalConceptDataInput;
  } = relDataRaw;
  // We don't allow inline data in upload
  let relationType: CrossAppRelationTypeSchema | undefined;
  if ("relation_inline" in relData) {
    relationType = node.relation as CrossAppRelationTypeSchema;
    delete relData["relation_inline"];
    relData = {
      ...relData,
      ...decodeLocalRef(relationType, "relation_local_id"),
    };
  }
  const refLocalIds = Object.fromEntries(
    Object.entries(relData)
      .filter(([k]) => k.endsWith("_local_id"))
      .map(([k, v]) => [k.substring(0, k.length - 9), v]),
  ) as Record<string, string>;
  const refIds = Object.fromEntries(
    Object.entries(relData).filter(
      ([k]) => k.endsWith("_id") && !k.endsWith("_local_id"),
    ),
  ) as Record<string, number>;
  return filterUndefined<LocalConceptDataInput>({
    ...decodeLocalRef(node, "source_local_id"),
    name: node.label,
    ...decodeRefOrInline({
      data: node.author,
      dbVarName: "author_id",
      localVarName: "author_local_id",
      inlineVarName: "author_inline",
      encoder: crossAppAccountToDbAccount,
    }),
    is_schema: true,
    literal_content: filterUndefined({
      roles: ["source", "destination"],
      label: node.label || relationType?.label,
      complement: node.complement || relationType?.complement,
    }),
    local_reference_content:
      Object.keys(refLocalIds).length > 0 ? refLocalIds : undefined,
    reference_content: Object.keys(refIds).length > 0 ? refIds : undefined,
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};

export const crossAppRelationToDbConcept = (
  node: CrossAppRelation,
  currentSpaceUri: string,
): LocalConceptDataInput => {
  const relData = {
    ...decodeLocalOrRemoteRef({
      ref: node.source,
      dbVarName: "source",
      localVarName: "source_local_id",
      currentSpaceUri,
    }),
    ...decodeLocalOrRemoteRef({
      ref: node.destination,
      dbVarName: "destination",
      localVarName: "destination_local_id",
      currentSpaceUri,
    }),
  };
  const refLocalIds = Object.fromEntries(
    Object.entries(relData)
      .filter(([k]) => k.endsWith("_local_id"))
      .map(([k, v]) => [k.substring(0, k.length - 9), v]),
  ) as Record<string, string>;
  const refIds = Object.fromEntries(
    Object.entries(relData).filter(
      ([k]) => k.endsWith("_id") && !k.endsWith("_local_id"),
    ),
  ) as Record<string, number>;

  return filterUndefined<LocalConceptDataInput>({
    ...decodeLocalRef(node, "source_local_id"),
    ...decodeRefOrInline({
      data: node.author,
      dbVarName: "author_id",
      localVarName: "author_local_id",
      inlineVarName: "author_inline",
      encoder: crossAppAccountToDbAccount,
    }),
    local_reference_content: refLocalIds,
    reference_content: refIds,
    created: node.createdAt?.toISOString(),
    last_modified: node.modifiedAt?.toISOString(),
  });
};
