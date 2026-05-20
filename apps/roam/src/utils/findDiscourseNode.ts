import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";
import type { SettingsSnapshot } from "~/components/settings/utils/accessors";

const discourseNodeTypeCache: Record<string, DiscourseNode | false> = {};

const findDiscourseNode = ({
  uid,
  title,
  nodes,
  snapshot,
}: {
  uid: string;
  title?: string;
  nodes?: DiscourseNode[];
  snapshot?: SettingsSnapshot;
}): DiscourseNode | false => {
  if (typeof discourseNodeTypeCache[uid] !== "undefined") {
    return discourseNodeTypeCache[uid];
  }

  const resolvedNodes = nodes ?? getDiscourseNodes(undefined, snapshot);
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
