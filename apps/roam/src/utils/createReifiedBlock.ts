import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import setBlockProps from "./setBlockProps";
import { getSetting } from "~/utils/extensionSettings";

export const queryForReifiedBlocks = async (
  parameterUids: Record<string, string>,
  strict: boolean = true,
): Promise<string | string[] | null> => {
  // TODO: Check that the parameterUids keys correspond to the schema
  const paramsAsSeq = Object.entries(parameterUids);
  const query = `[:find ?u ?d
  :in $ ${paramsAsSeq.map(([k]) => "?" + k).join(" ")}
  :where [?s :block/uid ?u] [?s :block/props ?p] [(get ?p :discourse-graph) ?d]
  ${paramsAsSeq.map(([k]) => `[(get ?d :${k}) ?${k}]`).join(" ")} ]`;
  const result = (await window.roamAlphaAPI.data.async.q(
    query,
    ...paramsAsSeq.map(([, v]) => v),
  )) as [string, Record<string, string>][];
  if (strict) {
    const resultF = result
      .filter(([, params]) => Object.keys(params).length === paramsAsSeq.length)
      .map(([uid]) => uid);
    if (resultF.length > 0) return resultF[0];
  } else {
    return result.map(([uid]) => uid);
  }
  return null;
};

export const checkForReifiedBlock = async (
  parameterUids: Record<string, string>,
): Promise<string | null> => {
  const result = await queryForReifiedBlocks(parameterUids, true);
  if (Array.isArray(result)) return result[0]; // this should never happen with strict
  return result;
};

export const createReifiedBlock = async ({
  destinationBlockUid,
  schemaUid,
  parameterUids,
}: {
  destinationBlockUid: string;
  schemaUid: string;
  parameterUids: Record<string, string>;
}): Promise<string> => {
  const newUid = window.roamAlphaAPI.util.generateUID();
  // TODO: Check that the parameterUids keys correspond to the schema
  const data = {
    ...parameterUids,
    hasSchema: schemaUid,
  };
  const exists = await checkForReifiedBlock(data);
  if (exists !== null) return exists;
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
    "discourse-graph": data,
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
