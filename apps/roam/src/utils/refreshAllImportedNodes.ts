import { getImportedNodeUids } from "./importedSourceIdentity";
import { refreshImportedNode } from "./refreshImportedNode";

type RefreshAllImportedNodesResult = {
  refreshed: number;
  skipped: number;
  failed: number;
  warnings: string[];
};

export const refreshAllImportedNodes =
  async (): Promise<RefreshAllImportedNodesResult> => {
    const pageUids = await getImportedNodeUids();
    const counts: RefreshAllImportedNodesResult = {
      refreshed: 0,
      skipped: 0,
      failed: 0,
      warnings: [],
    };
    for (const pageUid of pageUids) {
      const result = await refreshImportedNode({ pageUid, force: false });
      counts[result.status] += 1;
      if (result.warning)
        counts.warnings.push(`${result.message} ${result.warning}`);
    }
    return counts;
  };
