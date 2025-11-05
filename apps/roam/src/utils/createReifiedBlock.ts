import createBlock from "roamjs-components/writes/createBlock";
import createPage from "roamjs-components/writes/createPage";
import getPageUidByPageTitle from "roamjs-components/queries/getPageUidByPageTitle";
import setBlockProps from "./setBlockProps";
import { getSetting } from "~/utils/extensionSettings";

export const createReifiedBlock = async (
  destinationBlockUid: string,
  schemaUid: string,
  parameterUids: Record<string, string>,
): Promise<string> => {
  // TODO/Question: Should we try to ensure uniqueness?
  const newUid = window.roamAlphaAPI.util.generateUID();
  await createBlock({
    node: {
      text: newUid,
      uid: newUid,
    },
    parentUid: destinationBlockUid,
    order: "last",
  });
  // TODO: Check that the parameterUids keys correspond to the schema
  setBlockProps(newUid, {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    "discourse-graph": {
      ...parameterUids,
      hasSchema: schemaUid,
    },
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

export const createReifiedRelation = async (
  sourceUid: string,
  relationBlockUid: string,
  destinationUid: string,
): Promise<string | undefined> => {
  const authorized = getSetting("use-reified-relations");
  if (authorized) {
    return await createReifiedBlock(
      await getRelationPageUid(),
      relationBlockUid,
      {
        sourceUid,
        destinationUid,
      },
    );
  }
};
