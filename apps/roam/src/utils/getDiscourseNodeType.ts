import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";

export const getDiscourseNodeTypeByTitle = (
  title: string,
  nodeSchemas?: DiscourseNode[],
): DiscourseNode | null => {
  nodeSchemas = nodeSchemas || getDiscourseNodes();
  const formatMatches = nodeSchemas.filter((schema) => {
    const format = schema.format || "";
    if (format.trim().length == 0) return false;

    const formatRe = getDiscourseNodeFormatExpression(format);
    if (formatRe.toString().length === 10)
      // exclude universal matches
      return false;
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
