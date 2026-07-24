import { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { getAvailableGroupIds } from "@repo/database/lib/groups";
import { nodeUidsWithTypeToCrossApp } from "./roamToCrossAppConverters";

export type NodeUidWithType = {
  uid: string;
  type: string;
};

type PublishNodesResult = {
  publishedNodeUids: string[];
  skippedUnsyncedUids: string[];
  okGroupIds: string[];
  failedGroupIds: string[];
};

// 23505 = unique_violation: the grant already exists, which counts as success.
const isIgnorableUpsertError = (error: { code?: string } | null): boolean =>
  !error || error.code === "23505";

const onlyStrings = (values: (string | null)[]): string[] =>
  values.filter((value): value is string => typeof value === "string");

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
  const requestedGroupIds = [...new Set(groupIds)];
  const targetGroupIds = requestedGroupIds.filter((groupId) =>
    availableGroupIds.has(groupId),
  );
  result.failedGroupIds = requestedGroupIds.filter(
    (groupId) => !availableGroupIds.has(groupId),
  );
  if (targetGroupIds.length === 0) return result;

  const uids = [...new Set(nodes.map((node) => node.localId))];

  const syncedRes = await client
    .from("my_concepts")
    .select("source_local_id")
    .eq("space_id", spaceId)
    .eq("is_schema", false)
    .in("source_local_id", uids);
  if (syncedRes.error) throw syncedRes.error;
  const syncedUids = new Set(
    onlyStrings((syncedRes.data ?? []).map((row) => row.source_local_id)),
  );

  result.skippedUnsyncedUids = uids.filter((uid) => !syncedUids.has(uid));
  const syncedNodeUids = uids.filter((uid) => syncedUids.has(uid));
  if (syncedNodeUids.length === 0) return result;

  // Required dependency: the node-type schema concept, when it is synced too.
  const types = [
    ...new Set(
      nodes
        .filter((node) => syncedUids.has(node.localId))
        .map((node) => node.nodeType),
    ),
  ];
  const schemaRes = await client
    .from("my_concepts")
    .select("source_local_id")
    .eq("space_id", spaceId)
    .eq("is_schema", true)
    .in("source_local_id", types);
  if (schemaRes.error) throw schemaRes.error;
  const syncedSchemaIds = onlyStrings(
    (schemaRes.data ?? []).map((row) => row.source_local_id),
  );

  const resourceIds = [...syncedNodeUids, ...syncedSchemaIds];

  for (const groupId of targetGroupIds) {
    // Existing reader/editor access is broader than partial, so leave it intact.
    const spaceAccessRes = await client
      .from("SpaceAccess")
      .upsert(
        { account_uid: groupId, space_id: spaceId, permissions: "partial" },
        { ignoreDuplicates: true },
      );
    if (!isIgnorableUpsertError(spaceAccessRes.error)) {
      result.failedGroupIds.push(groupId);
      continue;
    }

    const grantRes = await client.from("ResourceAccess").upsert(
      resourceIds.map((sourceLocalId) => ({
        account_uid: groupId,
        source_local_id: sourceLocalId,
        space_id: spaceId,
      })),
      { ignoreDuplicates: true },
    );
    if (!isIgnorableUpsertError(grantRes.error)) {
      result.failedGroupIds.push(groupId);
      continue;
    }

    result.okGroupIds.push(groupId);
  }

  result.publishedNodeUids = result.okGroupIds.length > 0 ? syncedNodeUids : [];
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
