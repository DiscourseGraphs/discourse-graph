import { DatalogClause } from "roamjs-components/types/native";
import conditionToDatalog from "./conditionToDatalog";
import getDiscourseNodeFormatExpression from "./getDiscourseNodeFormatExpression";
import type { DiscourseNode } from "~/types/index";
import replaceDatalogVariables from "./replaceDatalogVariables";

const discourseNodeFormatToDatalog = ({
  freeVar,
  ...node
}: DiscourseNode & {
  freeVar: string;
}): DatalogClause[] => {
  if (node.specification.length) {
    const clauses = node.specification.flatMap(conditionToDatalog);
    return replaceDatalogVariables([{ from: node.text, to: freeVar }], clauses);
  }
  return conditionToDatalog({
    source: freeVar,
    relation: "has title",
    target: `/${getDiscourseNodeFormatExpression(node.format).source}/`,
    type: "clause",
    uid: window.roamAlphaAPI.util.generateUID(),
  });
};

export default discourseNodeFormatToDatalog;
