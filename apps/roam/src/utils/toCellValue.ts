import { BLOCK_REF_REGEX } from "roamjs-components/dom/constants";
import getCurrentUserUid from "roamjs-components/queries/getCurrentUserUid";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getTextByBlockUid from "roamjs-components/queries/getTextByBlockUid";
import extractTag from "roamjs-components/util/extractTag";

const namespaceSettingCache: Record<string, string> = {};

const getNamespaceSetting = () => {
  const user = getCurrentUserUid();
  if (namespaceSettingCache[user]) return namespaceSettingCache[user];

  const value =
    (
      window.roamAlphaAPI.data.fast.q(
        `[:find [pull ?u [:user/settings]] :where [?u :user/uid "${user}"]]`,
      )?.[0]?.[0] as {
        ":user/settings": {
          ":namespace-options": ("partial" | "none" | "full")[];
        };
      }
    )?.[":user/settings"]?.[":namespace-options"]?.[0] || "full";
  namespaceSettingCache[user] = value;
  setTimeout(() => delete namespaceSettingCache[user], 1000 * 60 * 1);
  return value;
};

const resolveRefs = (text: string, refs = new Set<string>()): string => {
  return text.replace(new RegExp(BLOCK_REF_REGEX, "g"), (_, blockUid) => {
    if (refs.has(blockUid)) return "";
    refs.add(blockUid);
    const reference = getTextByBlockUid(blockUid);
    return resolveRefs(reference, new Set(refs));
  });
};

const toCellValue = ({
  value,
  uid,
  defaultValue = "",
}: {
  value: number | Date | string;
  defaultValue?: string;
  uid: string;
}) => {
  const initialValue =
    value instanceof Date
      ? window.roamAlphaAPI.util.dateToPageTitle(value)
      : typeof value === "undefined" || value === null
        ? defaultValue
        : extractTag(resolveRefs(value.toString()));
  const namespaceSetting = getNamespaceSetting();

  const formattedValue =
    typeof value === "string" && !!getPageTitleByPageUid(uid)
      ? namespaceSetting === "full"
        ? initialValue.split("/").slice(-1)[0]
        : namespaceSetting === "partial"
          ? initialValue
              .split("/")
              .map((v, i, a) => (i === a.length - 1 ? v : v.slice(0, 1)))
              .join("/")
          : initialValue
      : initialValue;
  return formattedValue;
};

export default toCellValue;
