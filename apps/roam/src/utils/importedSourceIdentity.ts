import type { Rid } from "@repo/database/crossAppContracts";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";
import getBlockProps, { type json } from "./getBlockProps";
import { setBlockPropsAsync } from "./setBlockProps";

export type ImportedSourceIdentity = {
  sourceModifiedAt: string;
  sourceNodeRid: Rid;
};

export const IMPORTED_FROM_PROP_KEY = "importedFrom";
const SOURCE_NODE_RID_KEY = "sourceNodeRid";
const SOURCE_MODIFIED_AT_KEY = "sourceModifiedAt";

export const isJsonObject = (value: json): value is Record<string, json> =>
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
