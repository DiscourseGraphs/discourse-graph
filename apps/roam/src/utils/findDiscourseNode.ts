import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";

const discourseNodeTypeCache: Record<string, DiscourseNode | false> = {};

const findDiscourseNode = (
  uid = "",
  nodes = getDiscourseNodes(),
): DiscourseNode | false => {
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

export const findDiscourseNodeByTitleAndUid = ({
  uid,
  title,
  nodes,
}: {
  uid: string;
  title: string;
  nodes?: DiscourseNode[];
}): DiscourseNode | false => {
  nodes = nodes || getDiscourseNodes();
  if (typeof discourseNodeTypeCache[uid] !== "undefined") {
    return discourseNodeTypeCache[uid];
  }

  const matchingNode = nodes.find((node) =>
    matchDiscourseNode({ ...node, title }),
  );

  discourseNodeTypeCache[uid] = matchingNode || false;
  return discourseNodeTypeCache[uid];
};
