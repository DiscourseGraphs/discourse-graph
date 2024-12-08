import compileDatalog from "./compileDatalog";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import conditionToDatalog from "./conditionToDatalog";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";
import type { DiscourseNode } from "./getDiscourseNodes";
import replaceDatalogVariables from "./replaceDatalogVariables";

const matchDiscourseNode = ({
  format,
  specification,
  text,
  ...rest
}: Pick<DiscourseNode, "format" | "specification" | "text"> &
  (
    | {
        title: string;
      }
    | { uid: string }
  )) => {
  if (specification.length) {
    const where = replaceDatalogVariables(
      [{ from: text, to: "node" }],
      specification.flatMap((c) =>
        conditionToDatalog(c)
      )
    ).map((c) => compileDatalog(c, 0));
    const firstClause =
      "title" in rest
        ? `[or-join [?node] [?node :node/title "${normalizePageTitle(
            rest.title
          )}"] [?node :block/string "${normalizePageTitle(rest.title)}"]]`
        : `[?node :block/uid "${rest.uid}"]`;
    return !!window.roamAlphaAPI.data.fast.q(
      `[:find ?node :where ${firstClause} ${where.join(" ")}]`
    ).length;
  }
  const title = "title" in rest ? rest.title : getPageTitleByPageUid(rest.uid);
  return getDiscourseNodeFormatExpression(format).test(title);
};

export default matchDiscourseNode;
