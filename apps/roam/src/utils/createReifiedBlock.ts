import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";

export const DISCOURSE_GRAPH_PROP_NAME = "discourse-graph";
export const TENTATIVE_PROP_KEY = "tentative";
export const IMPORTED_FROM_PROP_KEY = "importedFrom";

// Annotations describe a relation's review/provenance state; they are not part
// of its identity, so lookups by role parameters must ignore them.
const RELATION_ANNOTATION_KEYS = new Set<string>([
  TENTATIVE_PROP_KEY,
  IMPORTED_FROM_PROP_KEY,
]);

const countRoleKeys = (params: Record<string, unknown>): number =>
  Object.keys(params).filter((k) => !RELATION_ANNOTATION_KEYS.has(k)).length;

const SANE_ROLE_NAME_RE = new RegExp(/^[\w-]*$/);

export const strictQueryForReifiedBlocks = async (
  parameterUids: Record<string, string>,
): Promise<string | null> => {
  const paramsAsSeq = Object.entries(parameterUids);
  // validate parameter names
  if (
    Object.keys(parameterUids).filter((k) => !k.match(SANE_ROLE_NAME_RE)).length
  )
    throw new Error(
      `invalid parameter names in ${Object.keys(parameterUids).join(", ")}`,
    );
  const query = `[:find ?u ?d
  :in $ ${paramsAsSeq.map(([k]) => "?" + k).join(" ")}
  :where [?s :block/uid ?u] [?s :block/props ?p] [(get ?p :${DISCOURSE_GRAPH_PROP_NAME}) ?d]
  ${paramsAsSeq.map(([k]) => `[(get ?d :${k}) ?${k}]`).join(" ")} ]`;
  const result = (await window.roamAlphaAPI.data.async.q(
    query,
    ...paramsAsSeq.map(([, v]) => v),
  )) as [string, Record<string, string>][];
  // post-filtering because cannot filter by number of keys in datascript
  const numParams = countRoleKeys(parameterUids);
  const resultF = result
    .filter(([, params]) => countRoleKeys(params) === numParams)
    .map(([uid]) => uid);
  if (resultF.length > 1) {
    const paramsAsText = Object.entries(parameterUids)
      .map(([k, v]) => `${k}: '${v}'`)
      .join(", ");
    console.warn(
      `${resultF.length} results in strict query for {${paramsAsText}}`,
    );
  }
  return resultF.length > 0 ? resultF[0] : null;
};

const createReifiedBlock = async ({
  destinationBlockUid,
  schemaUid,
  parameterUids,
}: {
  destinationBlockUid: string;
  schemaUid: string;
  parameterUids: Record<string, string>;
}): Promise<string> => {
  // TODO: Check that the parameterUids keys correspond to the schema
  const data = {
    ...parameterUids,
    hasSchema: schemaUid,
  };
  const existing = await strictQueryForReifiedBlocks(data);
  if (existing !== null) return existing;
  const newUid = window.roamAlphaAPI.util.generateUID();
  await createBlock({
    node: {
      text: newUid,
      uid: newUid,
      props: {
        [DISCOURSE_GRAPH_PROP_NAME]: data,
      },
    },
    parentUid: destinationBlockUid,
    order: "last",
  });
  return newUid;
};

const RELATION_PAGE_TITLE = "roam/js/discourse-graph/relations";
let relationPageUid: string | undefined = undefined;

const getOrCreateRelationPageUid = async (): Promise<string> => {
  if (relationPageUid === undefined) {
    relationPageUid = getPageUidByPageTitle(RELATION_PAGE_TITLE);
    if (relationPageUid === "") {
      relationPageUid = await createPage({ title: RELATION_PAGE_TITLE });
    }
  }
  return relationPageUid;
};

export const getExistingRelationPageUid = (): string | undefined => {
  if (relationPageUid === undefined) {
    const uid = getPageUidByPageTitle(RELATION_PAGE_TITLE);
    if (uid !== "") relationPageUid = uid;
  }
  return relationPageUid;
};

export const countReifiedRelations = async (): Promise<number> => {
  const pageUid = getExistingRelationPageUid();
  if (pageUid === undefined) return 0;
  const r = await window.roamAlphaAPI.data.async.q(
    `[:find (count ?c) :where [?p :block/children ?c] [?p :block/uid "${pageUid}"]]`,
  );
  return (r[0] || [0])[0] as number;
};

export type ReifiedRelationData = {
  sourceUid: string;
  destinationUid: string;
  hasSchema: string;
  tentative?: string;
  importedFromRid?: string;
};

export type ReifiedRelationDataWithRelId = ReifiedRelationData & {
  relationId: string;
};

export const getReifiedRelations = async (): Promise<
  ReifiedRelationDataWithRelId[]
> => {
  const pageUid = getExistingRelationPageUid();
  if (pageUid === undefined) return [];
  const r = await window.roamAlphaAPI.data.async.q(
    `[:find ?ruid ?rdata :where
      [?p :block/uid "${pageUid}"]
      [?p :block/children ?c]
      [?c :block/uid ?ruid]
      [?c :block/props ?pr]
      [(get ?pr :${DISCOURSE_GRAPH_PROP_NAME}) ?rdata] ]`,
  );
  return r.map((x) => ({
    relationId: x[0] as string,
    ...(x[1] as ReifiedRelationData),
  }));
};

export const createReifiedRelation = async ({
  sourceUid,
  relationBlockUid,
  destinationUid,
  tentative,
}: {
  sourceUid: string;
  relationBlockUid: string;
  destinationUid: string;
  tentative?: boolean;
}): Promise<string> => {
  const parameterUids: Record<string, string> = {
    sourceUid,
    destinationUid,
    ...(tentative !== undefined && {
      [TENTATIVE_PROP_KEY]: String(tentative),
    }),
  };
  return await createReifiedBlock({
    destinationBlockUid: await getOrCreateRelationPageUid(),
    schemaUid: relationBlockUid,
    parameterUids,
  });
};
