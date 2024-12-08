import getDiscourseNodes, { DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";

const discourseNodeTypeCache: Record<string, DiscourseNode | false> = {};

const findDiscourseNode = (uid = "", nodes = getDiscourseNodes()) =>
  typeof discourseNodeTypeCache[uid] !== "undefined"
    ? discourseNodeTypeCache[uid]
    : (discourseNodeTypeCache[uid] =
        nodes.find((n) => matchDiscourseNode({ ...n, uid })) || false);

export default findDiscourseNode;
