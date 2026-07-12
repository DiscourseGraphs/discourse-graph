import type { DGSupabaseClient } from "@repo/database/lib/client";
import {
  listGroupSharedNodes,
  type SharedNodeCandidate,
} from "@repo/database/lib/sharedNodes";
import { getImportedSourceRids } from "./importedSourceIdentity";

export type DiscoveredSharedNode = {
  alreadyImported: boolean;
  modifiedAt: string;
  sourceApp: "Roam" | "Obsidian";
  sourceNodeId?: string;
  sourceNodeRid: string;
  sourceSpaceDatabaseId: number;
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
    sourceSpaceDatabaseId: candidate.spaceId,
    sourceSpaceId: candidate.spaceUri,
    sourceSpaceName: candidate.spaceName,
    title: candidate.title,
  }));

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
