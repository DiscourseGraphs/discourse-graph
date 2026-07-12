import { getSharedNodePayload } from "@repo/database/lib/sharedNodes";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import type { DiscoveredSharedNode } from "./discoverSharedNodes";
import type { SharedNodeImportStatus } from "./importSelectedSharedNodes";
import { materializeObsidianNode } from "./materializeObsidianNode";

export const importDiscoveredSharedNode = async ({
  client,
  node,
}: {
  client: DGSupabaseClient;
  node: DiscoveredSharedNode;
}): Promise<SharedNodeImportStatus> => {
  if (node.sourceApp !== "Obsidian") return "skipped";
  if (!node.sourceNodeId)
    throw new Error(`Shared node '${node.sourceNodeRid}' has no source ID`);

  const payload = await getSharedNodePayload({
    client,
    sourceLocalId: node.sourceNodeId,
    spaceId: node.sourceSpaceDatabaseId,
  });
  const result = await materializeObsidianNode({
    node: payload,
    sourceModifiedAt: node.modifiedAt,
    sourceNodeRid: node.sourceNodeRid,
  });
  if (!result.success) throw new Error(result.error.message);

  return result.action === "updated" ? "updated" : "imported";
};
