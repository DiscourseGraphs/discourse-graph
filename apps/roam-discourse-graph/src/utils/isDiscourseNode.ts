import getDiscourseNodes from "./getDiscourseNodes";
import findDiscourseNode from "./findDiscourseNode";

const isDiscourseNode = (uid: string) => {
  const nodes = getDiscourseNodes();
  const node = findDiscourseNode(uid, nodes);
  if (!node) return false;
  return node.backedBy !== "default";
};

export default isDiscourseNode;
