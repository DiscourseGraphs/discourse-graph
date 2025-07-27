import compileDatalog from "./compileDatalog";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";
import normalizePageTitle from "roamjs-components/queries/normalizePageTitle";
import conditionToDatalog from "./conditionToDatalog";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";
import type { DiscourseNode } from "~/types/index";
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
  // Handle specification with single "has title" clause
  if (
    specification.length === 1 &&
    specification[0].type === "clause" &&
    specification[0].relation === "has title"
  ) {
    const title =
      "title" in rest ? rest.title : getPageTitleByPageUid(rest.uid);
    const regex = new RegExp(specification[0].target.slice(1, -1));
    return !specification[0].not && regex.test(title);
  }

  // Handle any other specification
  if (specification?.length) {
    const where = replaceDatalogVariables(
      [{ from: text, to: "node" }],
      specification.flatMap((c) => conditionToDatalog(c)),
    ).map((c) => compileDatalog(c, 0));
    const firstClause =
      "title" in rest
        ? `[or-join [?node] [?node :node/title "${normalizePageTitle(
            rest.title,
          )}"] [?node :block/string "${normalizePageTitle(rest.title)}"]]`
        : `[?node :block/uid "${rest.uid}"]`;
    return !!window.roamAlphaAPI.data.fast.q(
      `[:find ?node :where ${firstClause} ${where.join(" ")}]`,
    ).length;
  }

  // Fallback to format expression
  const title = "title" in rest ? rest.title : getPageTitleByPageUid(rest.uid);
  return getDiscourseNodeFormatExpression(format).test(title);
};

export default matchDiscourseNode;
