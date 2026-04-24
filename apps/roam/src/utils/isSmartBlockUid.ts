import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";

export const isSmartBlockUid = (uid: string): boolean => {
  const text = getTextByBlockUid(uid);
  if (!text) return false;
  return text.includes(":SmartBlock:");
};
