import deleteBlock from "roamjs-components/writes/deleteBlock";

export type QueryParentType = "block" | "page";

const deleteQuery = ({
  uid,
  parentType,
}: {
  uid: string;
  parentType: QueryParentType;
}): Promise<string> => {
  if (parentType === "page") {
    return window.roamAlphaAPI.deletePage({ page: { uid } }).then(() => uid);
  }

  return deleteBlock(uid);
};

export default deleteQuery;
