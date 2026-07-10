import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";
import getBlockProps, { type json } from "./getBlockProps";
import setBlockProps from "./setBlockProps";

export type ImportedSourceIdentity = {
  sourceModifiedAt: string;
  sourceNodeRid: string;
};

export const IMPORTED_FROM_PROP_KEY = "importedFrom";

const isJsonObject = (value: json): value is Record<string, json> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const parseImportedSourceIdentity = (
  props: Record<string, json>,
): ImportedSourceIdentity | undefined => {
  const discourseGraphProps = props[DISCOURSE_GRAPH_PROP_NAME];
  if (!isJsonObject(discourseGraphProps)) return undefined;

  const importedFrom = discourseGraphProps[IMPORTED_FROM_PROP_KEY];
  if (!isJsonObject(importedFrom)) return undefined;

  const { sourceModifiedAt, sourceNodeRid } = importedFrom;
  if (typeof sourceModifiedAt !== "string" || typeof sourceNodeRid !== "string")
    return undefined;

  return { sourceModifiedAt, sourceNodeRid };
};

export const readImportedSourceIdentity = (
  pageUid: string,
): ImportedSourceIdentity | undefined =>
  parseImportedSourceIdentity(getBlockProps(pageUid));

export const writeImportedSourceIdentity = ({
  pageUid,
  sourceModifiedAt,
  sourceNodeRid,
}: {
  pageUid: string;
  sourceModifiedAt: string;
  sourceNodeRid: string;
}): void => {
  const existing = getBlockProps(pageUid)[DISCOURSE_GRAPH_PROP_NAME];
  const discourseGraphProps = isJsonObject(existing) ? existing : {};

  setBlockProps(pageUid, {
    [DISCOURSE_GRAPH_PROP_NAME]: {
      ...discourseGraphProps,
      [IMPORTED_FROM_PROP_KEY]: { sourceModifiedAt, sourceNodeRid },
    },
  });
};

export const getImportedSourceRids = async (): Promise<Set<string>> => {
  const query = `[:find [?rid ...]
    :where
      [?page :block/props ?props]
      [(get ?props :${DISCOURSE_GRAPH_PROP_NAME}) ?dgData]
      [(get ?dgData :${IMPORTED_FROM_PROP_KEY}) ?importedFrom]
      [(get ?importedFrom :sourceNodeRid) ?rid]]`;
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
      [(get ?importedFrom :sourceNodeRid) ?sourceNodeRid]]`;
  const result = (await window.roamAlphaAPI.data.async.q(
    query,
    sourceNodeRid,
  )) as [string][];

  if (result.length > 1) {
    console.warn(
      `findImportedNodeUidBySourceRid: ${result.length} pages share source RID '${sourceNodeRid}'`,
    );
  }

  return result[0]?.[0] ?? null;
};
