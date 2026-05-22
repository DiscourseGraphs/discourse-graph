import getDiscourseNodes, { type DiscourseNode } from "./getDiscourseNodes";
import matchDiscourseNode from "./matchDiscourseNode";
import type { SettingsSnapshot } from "~/components/settings/utils/accessors";
import { getDiscourseNodeTypeCacheVersion } from "./discourseNodeTypeCache";
import type { PerformanceTraceArg } from "./performanceLogger";

let discourseNodeTypeCache: Record<string, DiscourseNode | false> = {};
let discourseNodeTypeCacheVersion = -1;

const findDiscourseNode = ({
  uid,
  title,
  nodes,
  snapshot,
  trace,
}: {
  uid: string;
  title?: string;
  nodes?: DiscourseNode[];
  snapshot?: SettingsSnapshot;
  trace?: PerformanceTraceArg;
}): DiscourseNode | false => {
  const currentCacheVersion = getDiscourseNodeTypeCacheVersion();
  if (discourseNodeTypeCacheVersion !== currentCacheVersion) {
    discourseNodeTypeCache = {};
    discourseNodeTypeCacheVersion = currentCacheVersion;
  }

  if (typeof discourseNodeTypeCache[uid] !== "undefined") {
    return discourseNodeTypeCache[uid];
  }

  const resolvedNodes = nodes ?? getDiscourseNodes(undefined, snapshot, trace);
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
