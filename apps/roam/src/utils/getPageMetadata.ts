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
    `[:find (pull ?p [:block/uid :create/time [:edit/time :as "modified"]]) (pull ?cu [:user/uid]) :where [?p :node/title "${normalizePageTitle(
      title,
    )}"] [?p :create/user ?cu]]`,
  ) as [[{ uid: string; time: number; modified: number }, { uid: string }]];
  if (results.length) {
    const [[{ uid: id, time: createdTime, modified: modifiedTime }, { uid }]] =
      results;

    const displayName = getDisplayName(uid);
    const date = new Date(createdTime);
    const modified = new Date(modifiedTime);
    return { displayName, date, id, modified };
  }
  const date = new Date();
  return {
    displayName: "Unknown",
    date,
    id: "",
    modified: date,
  };
};

export default getPageMetadata;
