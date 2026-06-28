import type { CrossAppNode } from "@repo/database/crossAppNodeContract";
import getBlockProps, { type json } from "./getBlockProps";
import setBlockProps from "./setBlockProps";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";

export type ImportedSourceIdentity = {
  sourceApp: CrossAppNode["sourceApp"];
  sourceSpaceId: string;
  sourceNodeId: string;
  sourceNodeRid: string;
  sourceTitle: string;
  sourceModifiedAt: string;
};

export const IMPORTED_FROM_PROP_KEY = "importedFrom";

const isJsonObject = (value: json): value is { [key: string]: json } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSourceApp = (value: json): value is CrossAppNode["sourceApp"] =>
  value === "roam" || value === "obsidian";

export const toImportedSourceIdentity = (
  node: CrossAppNode,
): ImportedSourceIdentity => ({
  sourceApp: node.sourceApp,
  sourceSpaceId: node.sourceSpaceId,
  sourceNodeId: node.sourceNodeId,
  sourceNodeRid: node.sourceNodeRid,
  sourceTitle: node.content.direct.value,
  sourceModifiedAt: node.sourceModifiedAt,
});

export const parseImportedSourceIdentity = (
  props: Record<string, json>,
): ImportedSourceIdentity | undefined => {
  const dgData = props[DISCOURSE_GRAPH_PROP_NAME];
  if (!isJsonObject(dgData)) return undefined;
  const imported = dgData[IMPORTED_FROM_PROP_KEY];
  if (!isJsonObject(imported)) return undefined;
  const {
    sourceApp,
    sourceSpaceId,
    sourceNodeId,
    sourceNodeRid,
    sourceTitle,
    sourceModifiedAt,
  } = imported;
  if (!isSourceApp(sourceApp)) return undefined;
  if (
    typeof sourceSpaceId !== "string" ||
    typeof sourceNodeId !== "string" ||
    typeof sourceNodeRid !== "string" ||
    typeof sourceTitle !== "string" ||
    typeof sourceModifiedAt !== "string"
  )
    return undefined;
  return {
    sourceApp,
    sourceSpaceId,
    sourceNodeId,
    sourceNodeRid,
    sourceTitle,
    sourceModifiedAt,
  };
};

export const readImportedSourceIdentity = (
  pageUid: string,
): ImportedSourceIdentity | undefined =>
  parseImportedSourceIdentity(getBlockProps(pageUid));

export const writeImportedSourceIdentity = (
  pageUid: string,
  identity: ImportedSourceIdentity,
): void => {
  const existing = getBlockProps(pageUid)[DISCOURSE_GRAPH_PROP_NAME];
  const dgData: Record<string, json> = isJsonObject(existing) ? existing : {};
  dgData[IMPORTED_FROM_PROP_KEY] = {
    sourceApp: identity.sourceApp,
    sourceSpaceId: identity.sourceSpaceId,
    sourceNodeId: identity.sourceNodeId,
    sourceNodeRid: identity.sourceNodeRid,
    sourceTitle: identity.sourceTitle,
    sourceModifiedAt: identity.sourceModifiedAt,
  };
  setBlockProps(pageUid, { [DISCOURSE_GRAPH_PROP_NAME]: dgData });
};

export const findImportedNodeUidByRid = async (
  sourceNodeRid: string,
): Promise<string | null> => {
  const query = `[:find ?uid
    :in $ ?rid
    :where
      [?page :block/uid ?uid]
      [?page :block/props ?props]
      [(get ?props :${DISCOURSE_GRAPH_PROP_NAME}) ?dgData]
      [(get ?dgData :${IMPORTED_FROM_PROP_KEY}) ?imported]
      [(get ?imported :sourceNodeRid) ?rid]]`;
  const result = (await window.roamAlphaAPI.data.async.q(
    query,
    sourceNodeRid,
  )) as [string][];
  if (result.length > 1) {
    console.warn(
      `findImportedNodeUidByRid: ${result.length} pages share sourceNodeRid '${sourceNodeRid}'`,
    );
  }
  return result.length > 0 ? result[0][0] : null;
};
