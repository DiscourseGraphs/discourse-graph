import { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { getAvailableGroupIds } from "@repo/database/lib/groups";
import { nodeUidsWithTypeToCrossApp } from "./roamToCrossAppConverters";
import { nodeSchemaToCrossApp } from "./roamToCrossAppConverters";
import { crossAppNodeSchemaToDbConcept } from "@repo/database/lib/crossAppConverters";
import { ensurePartialSpaceAccess } from "@repo/database/lib/groups";
import { isIgnorableUpsertError } from "@repo/database/lib/contextFunctions";
import getDiscourseNodes from "./getDiscourseNodes";
import { difference, intersection } from "@repo/utils/setOperations";
import internalError from "./internalError";

export type NodeUidWithType = {
  uid: string;
  type: string;
};

const onlyStrings = (values: (string | null)[]): string[] =>
  values.filter((value): value is string => typeof value === "string");

type PublishNodesResult = {
  publishedNodeSchemaUids: string[];
  publishedNodeUids: string[];
  syncedNodeSchemaUids: string[];
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
    publishedNodeSchemaUids: [],
    publishedNodeUids: [],
    syncedNodeSchemaUids: [],
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
  const nodeSchemaUids = new Set(nodes.map((node) => node.nodeType));
  const nodeSchemas = getDiscourseNodes()
    .filter((s) => nodeSchemaUids.has(s.type))
    .map((s) => nodeSchemaToCrossApp(s))
    .filter((s) => s !== null);

  const neededUids = [...nodeSchemaUids, ...nodeUids];

  const syncedRes = await client
    .from("my_concepts")
    .select("source_local_id")
    .eq("space_id", spaceId)
    .in("source_local_id", neededUids);
  if (syncedRes.error) {
    internalError({ error: syncedRes.error });
    return result;
  }
  const syncedUids = new Set(
    onlyStrings((syncedRes.data ?? []).map((row) => row.source_local_id)),
  );
  nodeUids = [...intersection(syncedUids, new Set(nodeUids))];
  const missingNodeSchemas = nodeSchemas.filter(
    (s) => !syncedUids.has(s.localId),
  );
  result.skippedUnsyncedUids = nodeUids.filter((uid) => !syncedUids.has(uid));
  const upsertConcepts = [
    ...missingNodeSchemas.map((s) => crossAppNodeSchemaToDbConcept(s)),
  ].filter((r) => r !== undefined);

  const resourceAccesses = [];
  const resourceIds = [...nodeUids, ...nodeSchemaUids];
  for (const groupId of groupIds) {
    resourceAccesses.push(
      ...resourceIds.map((sourceLocalId) => ({
        account_uid: groupId,
        source_local_id: sourceLocalId,
        space_id: spaceId,
      })),
    );
  }

  if (upsertConcepts.length > 0) {
    const response = await client.rpc("upsert_concepts", {
      v_space_id: spaceId,
      data: upsertConcepts,
    });
    if (response.error) {
      internalError({ error: response.error });
      return result;
    }
  }

  result.syncedNodeSchemaUids = missingNodeSchemas.map((s) => s.localId);
  const grantRes = await client
    .from("ResourceAccess")
    .upsert(resourceAccesses, { ignoreDuplicates: true });
  if (!isIgnorableUpsertError(grantRes.error)) {
    internalError({ error: grantRes.error });
    result.failedGroupIds.push(...groupIds);
    return result;
  }

  result.okGroupIds = groupIds;
  result.publishedNodeSchemaUids = [...nodeSchemaUids];
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
