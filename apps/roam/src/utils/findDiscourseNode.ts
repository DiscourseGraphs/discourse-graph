import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";

const discourseNodeTypeCache: Record<string, DiscourseNode | false> = {};

const findDiscourseNode = ({
  uid,
  title,
  nodes,
}: {
  uid: string;
  title?: string;
  nodes?: DiscourseNode[];
}): DiscourseNode | false => {
  if (typeof discourseNodeTypeCache[uid] !== "undefined") {
    return discourseNodeTypeCache[uid];
  }

  const resolvedNodes = nodes ?? getDiscourseNodes();
  const matchingNode =
    resolvedNodes.find((node) =>
      title === undefined
        ? matchDiscourseNode({ ...node, uid })
        : matchDiscourseNode({ ...node, title }),
    ) || false;
  discourseNodeTypeCache[uid] = matchingNode;
  return matchingNode;
};
export default findDiscourseNode;
