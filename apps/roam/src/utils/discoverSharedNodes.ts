import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  listGroupSharedNodes,
  type SharedNodeCandidate,
  type SharedNodePlatform,
} from "@repo/database/lib/sharedNodes";
import { DISCOURSE_GRAPH_PROP_NAME } from "./createReifiedBlock";

const IMPORTED_FROM_PROP_KEY = "importedFrom";

export type DiscoveredSharedNode = {
  alreadyImported: boolean;
  modifiedAt: string;
  sourceApp: SharedNodePlatform;
  sourceNodeId?: string;
  sourceNodeRid: string;
  sourceSpaceId: string;
  sourceSpaceName: string;
  title: string;
};

export const toDiscoveredSharedNodes = ({
  candidates,
  importedSourceRids,
}: {
  candidates: SharedNodeCandidate[];
  importedSourceRids: ReadonlySet<string>;
}): DiscoveredSharedNode[] =>
  candidates.map((candidate) => ({
    alreadyImported: importedSourceRids.has(candidate.rid),
    modifiedAt: candidate.lastModified,
    sourceApp: candidate.platform,
    sourceNodeId: candidate.sourceLocalId || undefined,
    sourceNodeRid: candidate.rid,
    sourceSpaceId: candidate.spaceUri,
    sourceSpaceName: candidate.spaceName,
    title: candidate.title,
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
  const [candidates, importedSourceRids] = await Promise.all([
    listGroupSharedNodes({ client, currentSpaceId }),
    getImportedSourceRids(),
  ]);
  return toDiscoveredSharedNodes({ candidates, importedSourceRids });
};
