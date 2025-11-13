import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import setBlockProps from "./setBlockProps";
import { getSetting } from "~/utils/extensionSettings";

export const DISCOURSE_GRAPH_PROP_NAME = "discourse-graph";

const SANE_ROLE_NAME_RE = new RegExp(/^[a-zA-Z][a-zA-Z0-9_-]*$/);

const queryForReifiedBlocksUtil = async (
  parameterUids: Record<string, string>,
): Promise<[string, Record<string, string>][]> => {
  const paramsAsSeq = Object.entries(parameterUids);
  // sanitize parameter names
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
  return (await window.roamAlphaAPI.data.async.q(
    query,
    ...paramsAsSeq.map(([, v]) => v),
  )) as [string, Record<string, string>][];
};

export const queryForReifiedBlocks = async (
  parameterUids: Record<string, string>,
): Promise<string[]> => {
  const results = await queryForReifiedBlocksUtil(parameterUids);
  return results.map(([uid]) => uid);
};

export const strictQueryForReifiedBlocks = async (
  parameterUids: Record<string, string>,
): Promise<string | null> => {
  const result = await queryForReifiedBlocksUtil(parameterUids);
  const numParams = Object.keys(parameterUids).length;
  // post-filtering because cannot filter by number of keys in datascript
  const resultF = result
    .filter(([, params]) => Object.keys(params).length === numParams)
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

export const createReifiedBlock = async ({
  destinationBlockUid,
  schemaUid,
  parameterUids,
  allowDuplicates = true,
}: {
  destinationBlockUid: string;
  schemaUid: string;
  parameterUids: Record<string, string>;
  allowDuplicates?: boolean;
}): Promise<string> => {
  // TODO: Check that the parameterUids keys correspond to the schema
  const data = {
    ...parameterUids,
    hasSchema: schemaUid,
  };
  if (allowDuplicates === false) {
    const existing = await strictQueryForReifiedBlocks(data);
    if (existing !== null) return existing;
  }
  const newUid = window.roamAlphaAPI.util.generateUID();
  await createBlock({
    node: {
      text: newUid,
      uid: newUid,
    },
    parentUid: destinationBlockUid,
    order: "last",
  });
  setBlockProps(newUid, {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    [DISCOURSE_GRAPH_PROP_NAME]: data,
  });
  return newUid;
};

const RELATION_PAGE_TITLE = "roam/js/discourse-graph/relations";
let relationPageUid: string | undefined = undefined;

export const getOrCreateRelationPageUid = async (): Promise<string> => {
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

export const createReifiedRelation = async ({
  sourceUid,
  relationBlockUid,
  destinationUid,
}: {
  sourceUid: string;
  relationBlockUid: string;
  destinationUid: string;
}): Promise<string | undefined> => {
  const authorized = getSetting("use-reified-relations");
  if (authorized) {
    return await createReifiedBlock({
      destinationBlockUid: await getOrCreateRelationPageUid(),
      schemaUid: relationBlockUid,
      parameterUids: {
        sourceUid,
        destinationUid,
      },
      allowDuplicates: false, // no duplicate relationships
    });
  }
};
