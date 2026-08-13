import type { Rid } from "@repo/database/crossAppContracts";
import { isRid } from "@repo/database/lib/rid";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";
import getBlockProps, { normalizeProps, type json } from "./getBlockProps";
import { setBlockPropsAsync } from "./setBlockProps";

export type ImportedSourceIdentity = {
  sourceModifiedAt: string;
  sourceNodeRid: Rid;
};

export const IMPORTED_FROM_PROP_KEY = "importedFrom";
export const IMPORTED_FROM_SCHEMAS_PROP_KEY = "importedFromSchemas";
const SOURCE_NODE_RID_KEY = "sourceNodeRid";
const SOURCE_MODIFIED_AT_KEY = "sourceModifiedAt";

const isJsonObject = (value: json): value is Record<string, json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseImportedSourceIdentity = (
  props: Record<string, json>,
): ImportedSourceIdentity | undefined => {
  const discourseGraphProps = props[DISCOURSE_GRAPH_PROP_NAME];
  if (!isJsonObject(discourseGraphProps)) return undefined;

  const importedFrom = discourseGraphProps[IMPORTED_FROM_PROP_KEY];
  if (!isJsonObject(importedFrom)) return undefined;

  const sourceModifiedAt = importedFrom[SOURCE_MODIFIED_AT_KEY];
  const sourceNodeRid = importedFrom[SOURCE_NODE_RID_KEY];
  if (typeof sourceModifiedAt !== "string" || typeof sourceNodeRid !== "string")
    return undefined;

  return { sourceModifiedAt, sourceNodeRid };
};

export const parseImportedFromSchemas = (
  props: Record<string, json>,
): ImportedSourceIdentity[] => {
  const results: ImportedSourceIdentity[] = [];
  const discourseGraphProps = props[DISCOURSE_GRAPH_PROP_NAME];
  if (!isJsonObject(discourseGraphProps)) return results;

  const importedFrom = discourseGraphProps[IMPORTED_FROM_SCHEMAS_PROP_KEY];
  if (!isJsonObject(importedFrom)) return results;

  for (const [sourceNodeRid, data] of Object.entries(importedFrom)) {
    if (!isRid(sourceNodeRid)) continue;
    if (!isJsonObject(data)) continue;
    const sourceModifiedAt = importedFrom[SOURCE_MODIFIED_AT_KEY];
    if (typeof sourceModifiedAt !== "string") continue;
    results.push({ sourceNodeRid, sourceModifiedAt });
  }

  return results;
};

export const readImportedSourceIdentity = (
  pageUid: string,
): ImportedSourceIdentity | undefined =>
  parseImportedSourceIdentity(getBlockProps(pageUid));

export const writeImportedSourceIdentity = async ({
  pageUid,
  sourceModifiedAt,
  sourceNodeRid,
}: {
  pageUid: string;
  sourceModifiedAt: string;
  sourceNodeRid: string;
}): Promise<void> => {
  const existing = getBlockProps(pageUid)[DISCOURSE_GRAPH_PROP_NAME];
  const discourseGraphProps = isJsonObject(existing) ? existing : {};

  await setBlockPropsAsync(pageUid, {
    [DISCOURSE_GRAPH_PROP_NAME]: {
      ...discourseGraphProps,
      [IMPORTED_FROM_PROP_KEY]: {
        [SOURCE_MODIFIED_AT_KEY]: sourceModifiedAt,
        [SOURCE_NODE_RID_KEY]: sourceNodeRid,
      },
    },
  });
};

export const addImportedSchemaSourceIdentity = async ({
  blockUid,
  sourceModifiedAt,
  sourceNodeRid,
}: {
  blockUid: string;
  sourceModifiedAt: string;
  sourceNodeRid: string;
}): Promise<void> => {
  const existing = getBlockProps(blockUid)[DISCOURSE_GRAPH_PROP_NAME];
  const discourseGraphProps = isJsonObject(existing) ? existing : {};
  let importedFromSchemaData =
    discourseGraphProps[IMPORTED_FROM_SCHEMAS_PROP_KEY];
  if (!isJsonObject(importedFromSchemaData)) importedFromSchemaData = {};
  importedFromSchemaData[sourceNodeRid] = {
    [SOURCE_MODIFIED_AT_KEY]: sourceModifiedAt,
  };

  await setBlockPropsAsync(blockUid, {
    [DISCOURSE_GRAPH_PROP_NAME]: {
      ...discourseGraphProps,
      [IMPORTED_FROM_SCHEMAS_PROP_KEY]: importedFromSchemaData,
    },
  });
};

export const getImportedSourceRids = async (): Promise<Set<string>> => {
  const query = `[:find [?rid ...]
    :where
      [?page :block/props ?props]
      [(get ?props :${DISCOURSE_GRAPH_PROP_NAME}) ?dgData]
      [(get ?dgData :${IMPORTED_FROM_PROP_KEY}) ?importedFrom]
      [(get ?importedFrom :${SOURCE_NODE_RID_KEY}) ?rid]]`;
  const result = (await window.roamAlphaAPI.data.async.q(query)) as unknown[];

  return new Set(
    result.filter((rid): rid is string => typeof rid === "string"),
  );
};

export const findImportedNodeUidBySourceRid = async (
  sourceNodeRid: string,
): Promise<string | null> => {
  const query = `[:find ?uid
    :in $ ?sourceNodeRid
    :where
      [?page :block/uid ?uid]
      [?page :block/props ?props]
      [(get ?props :${DISCOURSE_GRAPH_PROP_NAME}) ?dgData]
      [(get ?dgData :${IMPORTED_FROM_PROP_KEY}) ?importedFrom]
      [(get ?importedFrom :${SOURCE_NODE_RID_KEY}) ?sourceNodeRid]]`;
  const result = (await window.roamAlphaAPI.data.async.q(
    query,
    sourceNodeRid,
  )) as unknown[];

  const [first] = result;
  if (!Array.isArray(first)) return null;
  const [uid] = first as unknown[];
  return typeof uid === "string" ? uid : null;
};

export const findImportedSchemaUidBySourceRid = async (
  sourceNodeRid: string,
): Promise<string | null> => {
  const query = `[:find ?uid
    :in $ ?sourceNodeRid
    :where
      [?page :block/uid ?uid]
      [?page :block/props ?props]
      [(get ?props :${DISCOURSE_GRAPH_PROP_NAME}) ?dgData]
      [(get ?dgData :${IMPORTED_FROM_SCHEMAS_PROP_KEY}) ?importedFrom]
      [(get ?importedFrom ?sourceNodeRid) ?ridData]
      [(get ?ridData :${SOURCE_MODIFIED_AT_KEY}) ?modified]]`;
  const result = (await window.roamAlphaAPI.data.async.q(
    query,
    sourceNodeRid,
  )) as unknown[];

  const [first] = result;
  if (!Array.isArray(first)) return null;
  const [uid] = first as unknown[];
  return typeof uid === "string" ? uid : null;
};

export const getImportedSourceSchemaRids = async (): Promise<
  Record<string, string>
> => {
  const query = `[:find ?uid ?importedFrom
    :where
      [?block :block/uid ?uid]
      [?block :block/props ?props]
      [(get ?props :${DISCOURSE_GRAPH_PROP_NAME}) ?dgData]
      [(get ?dgData :${IMPORTED_FROM_SCHEMAS_PROP_KEY}) ?importedFrom]]`;
  const result = (await window.roamAlphaAPI.data.async.q(query)) as [
    string,
    Record<string, json>,
  ][];

  const rids: Record<string, string> = {};
  for (const [uid, rawImportedFrom] of result) {
    const importedFrom = normalizeProps(rawImportedFrom) as Record<
      string,
      json
    >;
    for (const sourceNodeRid of Object.keys(importedFrom)) {
      if (isRid(sourceNodeRid)) rids[sourceNodeRid] = uid;
    }
  }
  return rids;
};
