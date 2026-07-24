import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  listGroupSharedNodes,
  type SharedNode,
} from "@repo/database/lib/sharedNodes";
import type { Enums } from "@repo/database/dbTypes";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";

const IMPORTED_FROM_PROP_KEY = "importedFrom";

export type DiscoveredSharedNode = {
  alreadyImported: boolean;
  modifiedAt: string;
  sourceApp: Enums<"Platform">;
  sourceNodeId?: string;
  sourceNodeRid: string;
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
    sourceSpaceId: sharedNode.spaceUri,
    sourceSpaceName: sharedNode.spaceName,
    title: sharedNode.title,
  }));

const getImportedSourceRids = async (): Promise<Set<string>> => {
  const query = `[:find [?rid ...]
    :where
      [?page :block/props ?props]
      [(get ?props :${DISCOURSE_GRAPH_PROP_NAME}) ?dgData]
      [(get ?dgData :${IMPORTED_FROM_PROP_KEY}) ?imported]
      [(get ?imported :sourceNodeRid) ?rid]]`;
  const result = (await window.roamAlphaAPI.data.async.q(query)) as unknown[];
  return new Set(
    result.filter((rid): rid is string => typeof rid === "string"),
  );
};

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
