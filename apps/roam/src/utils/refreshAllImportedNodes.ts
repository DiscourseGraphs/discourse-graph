import { getImportedNodeUids } from "./importedSourceIdentity";
import {
  importRelationsAfterRefresh,
  refreshImportedNode,
} from "./refreshImportedNode";
import { getLoggedInClient } from "./supabaseContext";

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
      const result = await refreshImportedNode({
        pageUid,
        force: false,
        importRelations: false,
      });
      counts[result.status] += 1;
      if (result.warning)
        counts.warnings.push(`${result.message} ${result.warning}`);
    }
    if (counts.refreshed + counts.skipped === 0) return counts;
    const client = await getLoggedInClient();
    const relationWarning = client
      ? await importRelationsAfterRefresh(client)
      : "Could not import relations: could not connect to shared persistence.";
    if (relationWarning) counts.warnings.push(relationWarning);
    return counts;
  };
