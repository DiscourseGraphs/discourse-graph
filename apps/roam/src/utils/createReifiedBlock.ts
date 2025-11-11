import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import { getSetting } from "~/utils/extensionSettings";

export const DISCOURSE_GRAPH_PROP_NAME = "discourse-graph";

const strictQueryForReifiedBlocks = async (
  parameterUids: Record<string, string>,
): Promise<string | null> => {
  const paramsAsSeq = Object.entries(parameterUids);
  const query = `[:find ?u ?d
  :in $ ${paramsAsSeq.map(([k]) => "?" + k).join(" ")}
  :where [?s :block/uid ?u] [?s :block/props ?p] [(get ?p :${DISCOURSE_GRAPH_PROP_NAME}) ?d]
  ${paramsAsSeq.map(([k]) => `[(get ?d :${k}) ?_${k}] [(= ?${k} ?_${k})]`).join(" ")} ]`;
  // Note: the extra _k binding variable is only needed for the backend query somehow
  // In a local query, we can directly map to `[(get ?d :${k}) ?${k}]`
  const result = await Promise.resolve(
    window.roamAlphaAPI.data.backend.q(
      query,
      ...paramsAsSeq.map(([, v]) => v),
    ) as [string, Record<string, string>][],
  );
  // post-filtering because cannot filter by number of keys in datascript
  const numParams = Object.keys(parameterUids).length;
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
        // eslint-disable-next-line @typescript-eslint/naming-convention
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

const getRelationPageUid = async (): Promise<string> => {
  if (relationPageUid === undefined) {
    relationPageUid = getPageUidByPageTitle(RELATION_PAGE_TITLE);
    if (relationPageUid === "") {
      relationPageUid = await createPage({ title: RELATION_PAGE_TITLE });
    }
  }
  return relationPageUid;
};

export const countReifiedRelations = async (): Promise<number> => {
  const pageUid = await getRelationPageUid();
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
      destinationBlockUid: await getRelationPageUid(),
      schemaUid: relationBlockUid,
      parameterUids: {
        sourceUid,
        destinationUid,
      },
    });
  }
};
