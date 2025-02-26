import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";

const discourseNodeTypeCache: Record<string, DiscourseNode | false> = {};

const findDiscourseNode = (uid = "", nodes = getDiscourseNodes()) => {
  if (typeof discourseNodeTypeCache[uid] !== "undefined") {
    return discourseNodeTypeCache[uid];
  }

  const matchingNode = nodes.find((node) =>
    matchDiscourseNode({ ...node, uid }),
  );

  discourseNodeTypeCache[uid] = matchingNode || false;
  return discourseNodeTypeCache[uid];
};
export default findDiscourseNode;
