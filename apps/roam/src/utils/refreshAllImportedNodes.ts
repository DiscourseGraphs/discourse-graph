import { getImportedNodeUids } from "./importedSourceIdentity";
import { refreshImportedNode } from "./refreshImportedNode";

type RefreshAllImportedNodesResult = {
  refreshed: number;
  skipped: number;
  failed: number;
};

export const refreshAllImportedNodes =
  async (): Promise<RefreshAllImportedNodesResult> => {
    const pageUids = await getImportedNodeUids();
    const counts: RefreshAllImportedNodesResult = {
      refreshed: 0,
      skipped: 0,
      failed: 0,
    };
    for (const pageUid of pageUids) {
      const result = await refreshImportedNode({ pageUid, force: false });
      counts[result.status] += 1;
    }
    return counts;
  };
