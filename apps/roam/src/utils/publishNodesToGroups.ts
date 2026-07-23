import { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { getAvailableGroupIds } from "@repo/database/lib/groups";
import { nodeUidsWithTypeToCrossApp } from "./roamToCrossAppConverters";
import {
  reifiedRelationToCrossApp,
  relationTripleSchemaToCrossApp,
} from "./roamToCrossAppConverters";
import getDiscourseRelations from "./getDiscourseRelations";
import { getReifiedRelations } from "./createReifiedBlock";
import {
  crossAppRelationToDbConcept,
  crossAppRelationTripleSchemaToDbConcept,
} from "@repo/database/lib/crossAppConverters";
import type { LocalConceptDataInput } from "@repo/database/inputTypes";
import type { TablesInsert } from "@repo/database/dbTypes";

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

const getAllPublishedIdsByGroup = async (
  client: DGSupabaseClient,
  spaceId: number,
  groupIds: string[],
): Promise<Record<string, Set<string>>> => {
  const response = await client
    .from("ResourceAccess")
    .select("account_uid, source_local_id")
    .eq("space_id", spaceId)
    .in("account_uid", groupIds);
  if (response.error) throw response.error;
  const publishedIdsByGroupId = Object.fromEntries(
    groupIds.map((gid) => [gid, new Set<string>()]),
  );
  response.data.forEach(({ account_uid, source_local_id }) => {
    publishedIdsByGroupId[account_uid].add(source_local_id);
  });

  return publishedIdsByGroupId;
};

const getSpaceIdAndUrlsByGroupId = async (
  client: DGSupabaseClient,
  groupIds: string[],
): Promise<{
  spaceUrlById: Record<number, string>;
  spaceIdsByGroupId: Record<string, Set<number>>;
}> => {
  const response = await client
    .from("SpaceAccess")
    .select("account_uid, space_id")
    .in("account_uid", groupIds);
  if (response.error) throw response.error;
  const spaceIds = response.data.map((r) => r.space_id);
  const response2 = await client
    .from("Space")
    .select("id, url")
    .in("id", spaceIds);
  if (response2.error) throw response2.error;
  const spaceUrlById = Object.fromEntries(
    response2.data.map(({ id, url }) => [id, url]),
  );
  const spaceIdsByGroupId = Object.fromEntries(
    groupIds.map((gid) => [gid, new Set<number>()]),
  );
  response.data.forEach(({ account_uid, space_id }) => {
    spaceIdsByGroupId[account_uid].add(space_id);
  });
  return {
    spaceUrlById,
    spaceIdsByGroupId,
  };
};

// Use readImportedSourceIdentity from eng-1859 when it's merged.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const importedFromSpaceId = (nodeId: string): number | undefined => undefined;

export const publishCorrespondingRelations = async ({
  client,
  spaceId,
  groupIds,
  syncedUids,
  forNodeIds,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  groupIds: string[];
  syncedUids: Set<string>;
  forNodeIds?: Set<string>;
}): Promise<{
  upsertConcepts: LocalConceptDataInput[];
  publishInfo: TablesInsert<"ResourceAccess">[];
}> => {
  const allRelationsSchemas = getDiscourseRelations();
  const allRelationSchemasById = Object.fromEntries(
    allRelationsSchemas.map((s) => [s.id, s]),
  );
  // Should we even handle non-reified relations? Assuming not.
  // I need a way to know if a relation is imported, see importedFromSpaceId
  const allRelations = await getReifiedRelations();
  const spaceIdOfNodes: Record<string, number> = {};
  const isImportedFrom = (nodeLocalId: string): number => {
    let cached = spaceIdOfNodes[nodeLocalId];
    if (cached === undefined) {
      cached = spaceIdOfNodes[nodeLocalId] =
        importedFromSpaceId(nodeLocalId) || spaceId;
    }
    return cached === spaceId ? 0 : cached;
  };
  const relations =
    forNodeIds !== undefined
      ? allRelations.filter(
          (r) =>
            r.importedFromRid === undefined &&
            (forNodeIds.has(r.sourceUid) || forNodeIds.has(r.destinationUid)),
        )
      : allRelations.filter((r) => r.importedFromRid === undefined);
  const { spaceIdsByGroupId, spaceUrlById } = await getSpaceIdAndUrlsByGroupId(
    client,
    groupIds,
  );
  const isImportedFromSpaceUri = (uid: string) =>
    spaceUrlById[isImportedFrom(uid) || 0];
  const publishedIdsByGroup = await getAllPublishedIdsByGroup(
    client,
    spaceId,
    groupIds,
  );
  // calculate separately to avoid case of a relation between nodes published to or from different groups
  const relevantRelationIdsPerGroupId = Object.fromEntries(
    groupIds.map((groupId) => {
      const groupSpaceIds = spaceIdsByGroupId[groupId];
      const publishedIds = publishedIdsByGroup[groupId];
      return [
        groupId,
        relations
          .filter(
            (r) =>
              (publishedIds.has(r.sourceUid) ||
                groupSpaceIds.has(isImportedFrom(r.sourceUid) || 0)) &&
              (publishedIds.has(r.destinationUid) ||
                groupSpaceIds.has(isImportedFrom(r.destinationUid) || 0)),
          )
          .map((r) => r.relationId),
      ];
    }),
  );
  const allRelevantRelationIds = new Set(
    Object.values(relevantRelationIdsPerGroupId).flat(),
  );
  let allRelevantRelations = relations.filter((r) =>
    allRelevantRelationIds.has(r.relationId),
  );
  const relationSchemaIds = new Set(
    allRelevantRelations
      .map((r) => r.hasSchema)
      // filter out deleted schemas
      .filter((id) => id in allRelationSchemasById),
  );
  allRelevantRelations = allRelevantRelations.filter((r) =>
    relationSchemaIds.has(r.hasSchema),
  );
  const missingRelationSchemaTriples = allRelationsSchemas.filter(
    (r) => relationSchemaIds.has(r.id) && !syncedUids.has(r.id),
  );
  const missingRelations = allRelevantRelations.filter(
    (r) => !syncedUids.has(r.relationId),
  );
  const upsertConcepts = [
    ...missingRelationSchemaTriples
      .map((rs3) => relationTripleSchemaToCrossApp(rs3))
      .filter((rs3) => rs3 !== null)
      .map((rs3) => crossAppRelationTripleSchemaToDbConcept(rs3)),
    ...missingRelations
      .map((r) => reifiedRelationToCrossApp(r, isImportedFromSpaceUri))
      .filter((r) => r !== null)
      .map((r) => crossAppRelationToDbConcept(r)),
  ].filter((r) => r !== undefined);

  const publishInfo = [];
  for (const groupId of groupIds) {
    const groupRelationIds = new Set(relevantRelationIdsPerGroupId[groupId]);
    const groupMissingRelations = missingRelations.filter((r) =>
      groupRelationIds.has(r.relationId),
    );
    const groupMissingRelationIds = groupMissingRelations.map(
      (r) => r.relationId,
    );
    const groupSchemaIds = new Set(
      groupMissingRelations.map((r) => r.hasSchema),
    );
    const groupMissingSchemaIds = missingRelationSchemaTriples
      .filter((rs3) => groupSchemaIds.has(rs3.id))
      .map((rs3) => rs3.id);
    const groupMissingIds = [
      ...groupMissingRelationIds,
      ...groupMissingSchemaIds,
    ];
    publishInfo.push(
      ...groupMissingIds.map((sourceLocalId) => ({
        account_uid: groupId,
        source_local_id: sourceLocalId,
        space_id: spaceId,
      })),
    );
  }
  return { upsertConcepts, publishInfo };
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
  const { upsertConcepts, publishInfo } = await publishCorrespondingRelations({
    client,
    spaceId,
    groupIds: targetGroupIds,
    syncedUids,
    forNodeIds: new Set(syncedNodeUids),
  });
  const response = await client.rpc("upsert_concepts", {
    v_space_id: spaceId,
    data: upsertConcepts,
  });
  if (response.error) throw response.error;
  const grantRes = await client
    .from("ResourceAccess")
    .upsert(publishInfo, { ignoreDuplicates: true });
  if (!isIgnorableUpsertError(grantRes.error)) throw grantRes.error;

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
