import { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { getAvailableGroupIds } from "@repo/database/lib/groups";
import { nodeUidsWithTypeToCrossApp } from "./roamToCrossAppConverters";
import { ensurePartialSpaceAccess } from "@repo/database/lib/groups";
import { isIgnorableUpsertError } from "@repo/database/lib/contextFunctions";
import { difference, intersection } from "@repo/utils/setOperations";
import internalError from "./internalError";

export type NodeUidWithType = {
  uid: string;
  type: string;
};

const onlyStrings = (values: (string | null)[]): string[] =>
  values.filter((value): value is string => typeof value === "string");

type PublishNodesResult = {
  publishedNodeUids: string[];
  skippedUnsyncedUids: string[];
  okGroupIds: string[];
  failedGroupIds: string[];
};

// Grants a group access to already-synced discourse nodes by mirroring the
// Obsidian publish-to-group access model (SpaceAccess + ResourceAccess),
// without its file/frontmatter/relation/asset coupling.
//
// ResourceAccess has no foreign key on source_local_id, so granting access to a
// node that has not synced yet would create an orphaned row. We therefore only
// publish nodes confirmed present as instance concepts in this space, and
// report the rest as not-yet-synced (they self-heal on the next sync).
export const publishNodesToGroups = async ({
  client,
  spaceId,
  groupIds,
  nodes,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  groupIds: string[];
  nodes: CrossAppNode[];
}): Promise<PublishNodesResult> => {
  const result: PublishNodesResult = {
    publishedNodeUids: [],
    skippedUnsyncedUids: [],
    okGroupIds: [],
    failedGroupIds: [],
  };
  if (nodes.length === 0 || groupIds.length === 0) return result;

  const availableGroupIds = new Set(await getAvailableGroupIds(client));
  const requestedGroupIds = new Set(groupIds);
  groupIds = [...intersection(requestedGroupIds, availableGroupIds)];
  result.failedGroupIds = [...difference(requestedGroupIds, availableGroupIds)];
  if (groupIds.length === 0) return result;

  const { existing: existingSpaceAccess, missing: missingSpaceAccess } =
    await ensurePartialSpaceAccess({
      client,
      groupIds,
      spaceId,
    });
  if (missingSpaceAccess && Object.keys(missingSpaceAccess).length) {
    result.failedGroupIds = [
      ...result.failedGroupIds,
      ...groupIds.filter((id) => !(id in existingSpaceAccess)),
    ];
    groupIds = Object.keys(existingSpaceAccess);
  }
  if (groupIds.length === 0) return result;

  let nodeUids = [...new Set(nodes.map((node) => node.localId))];

  const syncedRes = await client
    .from("my_concepts")
    .select("source_local_id")
    .eq("space_id", spaceId)
    .in("source_local_id", nodeUids);
  if (syncedRes.error) {
    internalError({ error: syncedRes.error });
    return result;
  }
  const syncedUids = new Set(
    onlyStrings((syncedRes.data ?? []).map((row) => row.source_local_id)),
  );
  result.skippedUnsyncedUids = nodeUids.filter((uid) => !syncedUids.has(uid));
  nodeUids = [...intersection(syncedUids, new Set(nodeUids))];

  const resourceAccesses = [];
  for (const groupId of groupIds) {
    resourceAccesses.push(
      ...nodeUids.map((sourceLocalId) => ({
        account_uid: groupId,
        source_local_id: sourceLocalId,
        space_id: spaceId,
      })),
    );
  }

  const grantRes = await client
    .from("ResourceAccess")
    .upsert(resourceAccesses, { ignoreDuplicates: true });
  if (!isIgnorableUpsertError(grantRes.error)) {
    internalError({ error: grantRes.error });
    return result;
  }

  result.okGroupIds = groupIds;
  result.publishedNodeUids = nodeUids;

  return result;
};

export const publishNodeUidsWithTypeToGroups = async ({
  client,
  spaceId,
  groupIds,
  nodeUids,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  groupIds: string[];
  nodeUids: NodeUidWithType[];
}): Promise<PublishNodesResult> => {
  const nodes = await nodeUidsWithTypeToCrossApp(nodeUids);
  return await publishNodesToGroups({ client, spaceId, groupIds, nodes });
};
