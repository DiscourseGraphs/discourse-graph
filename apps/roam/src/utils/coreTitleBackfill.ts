import { difference } from "@repo/utils/setOperations";
import {
  partitionByCoreTitle,
  type CoreTitleProbeRow,
} from "@repo/database/lib/coreTitleBackfill";
import { type RoamDiscourseNodeData } from "./getAllDiscourseNodesSince";

export type CoreTitleBackfill = {
  nodesToBackfill: RoamDiscourseNodeData[];
  withCoreTitleCount: number;
  orphanedCount: number;
};

export const buildCoreTitleBackfill = ({
  conceptRows,
  localNodes,
}: {
  conceptRows: CoreTitleProbeRow[];
  localNodes: RoamDiscourseNodeData[];
}): CoreTitleBackfill => {
  const { missingCoreTitleIds, withCoreTitleCount } =
    partitionByCoreTitle(conceptRows);
  const localIds = new Set(localNodes.map((node) => node.source_local_id));
  return {
    nodesToBackfill: localNodes.filter((node) =>
      missingCoreTitleIds.has(node.source_local_id),
    ),
    withCoreTitleCount,
    orphanedCount: difference(missingCoreTitleIds, localIds).size,
  };
};

export const mergeNodesBySourceLocalId = (
  nodes: RoamDiscourseNodeData[],
  additionalNodes: RoamDiscourseNodeData[],
): RoamDiscourseNodeData[] => {
  const nodesById = new Map(nodes.map((node) => [node.source_local_id, node]));
  for (const node of additionalNodes) {
    if (!nodesById.has(node.source_local_id)) {
      nodesById.set(node.source_local_id, node);
    }
  }
  return [...nodesById.values()];
};
