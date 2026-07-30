import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  listGroupSharedNodes,
  type SharedNode,
} from "@repo/database/lib/sharedNodes";
import { getImportedSourceRids } from "./importedSourceIdentity";

export type DiscoveredSharedNode = {
  alreadyImported: boolean;
  sharedNode: SharedNode;
};

export const toDiscoveredSharedNodes = ({
  sharedNodes,
  importedSourceRids,
}: {
  sharedNodes: SharedNode[];
  importedSourceRids: ReadonlySet<string>;
}): DiscoveredSharedNode[] =>
  sharedNodes.map((sharedNode) => ({
    alreadyImported: importedSourceRids.has(sharedNode.rid),
    sharedNode,
  }));

export const discoverSharedNodes = async ({
  client,
  currentSpaceId,
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
}): Promise<DiscoveredSharedNode[]> => {
  const [sharedNodes, importedSourceRids] = await Promise.all([
    listGroupSharedNodes({ client, currentSpaceId }),
    getImportedSourceRids(),
  ]);
  return toDiscoveredSharedNodes({ sharedNodes, importedSourceRids });
};
