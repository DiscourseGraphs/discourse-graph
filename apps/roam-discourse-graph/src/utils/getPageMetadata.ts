import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import getDisplayNameByUid from "roamjs-components/queries/getDisplayNameByUid";

const displayNameCache: Record<string, string> = {};
const getDisplayName = (s: string) => {
  if (displayNameCache[s]) {
    return displayNameCache[s];
  }
  const value = getDisplayNameByUid(s);
  displayNameCache[s] = value;
  setTimeout(() => delete displayNameCache[s], 120000);
  return value;
};

const getPageMetadata = (title: string, cacheKey?: string) => {
  const results = window.roamAlphaAPI.q(
    `[:find (pull ?p [:create/time :block/uid]) (pull ?cu [:user/uid]) :where [?p :node/title "${normalizePageTitle(
      title
    )}"] [?p :create/user ?cu]]`
  ) as [[{ time: number; uid: string }, { uid: string }]];
  if (results.length) {
    const [[{ time: createdTime, uid: id }, { uid }]] = results;

    const displayName = getDisplayName(uid);
    const date = new Date(createdTime);
    return { displayName, date, id };
  }
  return {
    displayName: "Unknown",
    date: new Date(),
    id: "",
  };
};

export default getPageMetadata;
