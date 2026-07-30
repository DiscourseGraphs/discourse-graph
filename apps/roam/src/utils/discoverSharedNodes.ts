import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  listGroupSharedNodes,
  type SharedNode,
} from "@repo/database/lib/sharedNodes";
import type { Enums } from "@repo/database/dbTypes";
import { getImportedSourceRids } from "./importedSourceIdentity";

export type DiscoveredSharedNode = {
  alreadyImported: boolean;
  modifiedAt: string;
  sourceApp: Enums<"Platform">;
  sourceNodeId?: string;
  sourceNodeRid: string;
  sourceSpaceDbId: number;
  sourceSpaceId: string;
  sourceSpaceName: string;
  title: string;
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
    modifiedAt: sharedNode.lastModified,
    sourceApp: sharedNode.platform,
    sourceNodeId: sharedNode.sourceLocalId || undefined,
    sourceNodeRid: sharedNode.rid,
    sourceSpaceDbId: sharedNode.spaceId,
    sourceSpaceId: sharedNode.spaceUri,
    sourceSpaceName: sharedNode.spaceName,
    title: sharedNode.title,
  }));

export const toSharedNode = (node: DiscoveredSharedNode): SharedNode => ({
  rid: node.sourceNodeRid,
  sourceLocalId: node.sourceNodeId ?? "",
  spaceId: node.sourceSpaceDbId,
  spaceName: node.sourceSpaceName,
  spaceUri: node.sourceSpaceId,
  platform: node.sourceApp,
  title: node.title,
  lastModified: node.modifiedAt,
  // materializer never reads these
  created: null,
  directMetadata: null,
});

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
