import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";

const discourseNodeTypeCache: Record<string, DiscourseNode | false> = {};

const findDiscourseNode = ({
  uid,
  title,
  nodes = getDiscourseNodes(),
}: {
  uid?: string;
  title?: string;
  nodes?: DiscourseNode[];
}): DiscourseNode | false => {
  if (uid === undefined && title === undefined) return false;
  if (uid && typeof discourseNodeTypeCache[uid] !== "undefined") {
    return discourseNodeTypeCache[uid];
  }

  const matchingNode =
    nodes.find((node) =>
      title === undefined
        ? matchDiscourseNode({ ...node, uid: uid! })
        : matchDiscourseNode({ ...node, title }),
    ) || false;
  if (uid) discourseNodeTypeCache[uid] = matchingNode;
  return matchingNode;
};
export default findDiscourseNode;
