import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import "core-js/proposals/regexp-escaping";
import format from "date-fns/esm/fp/format/index.js";

// eslint-disable-next-line
const reEscape = (RegExp as any).escape as (str: string) => string;

const SUB_RE = new RegExp(/\\\{\w+\\\}/g);

export const formatToRegexpText = (format: string): string =>
  reEscape(format.trim()).replaceAll(SUB_RE, ".*");

export const getDiscourseNodeTypeByTitle = (
  title: string,
  nodeSchemas?: DiscourseNode[],
): DiscourseNode | null => {
  nodeSchemas = nodeSchemas || getDiscourseNodes();
  const formatMatches = nodeSchemas.filter((schema) => {
    const format = schema.format || "";
    if (format.trim().length == 0) return false;
    const formatReTxt = formatToRegexpText(format);
    if (formatReTxt.length === 2)
      // exclude universal matches
      return false;
    const formatRe = new RegExp(`^${formatReTxt}$`);
    return title.match(formatRe);
  });
  if (formatMatches.length > 0) {
    if (formatMatches.length > 1) {
      // We probably have to take conditions into account.
      // then it may be worth doing a query?
      console.warn(
        `Multiple matches for ${title}: ${formatMatches.map((e) => e.format).join(", ")}`,
      );
    }
    return formatMatches[0];
  }
  return null;
};

export const getDiscourseNodeTypeByUid = (
  nodeUid: string,
  nodeSchemas?: DiscourseNode[],
): DiscourseNode | null => {
  const title = getPageTitleByPageUid(nodeUid).trim();
  return getDiscourseNodeTypeByTitle(title, nodeSchemas);
};
