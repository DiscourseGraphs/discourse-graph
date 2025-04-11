import getBasicTreeByParentUid from "roamjs-components/queries/getBasicTreeByParentUid";
import toFlexRegex from "roamjs-components/util/toFlexRegex";

export const getBlockUidIfExists = (parentUid: string, key: string): string => {
  const tree = getBasicTreeByParentUid(parentUid);
  const node = tree.find((s) => toFlexRegex(key).test(s.text.trim()));
  return node?.uid || "";
};
