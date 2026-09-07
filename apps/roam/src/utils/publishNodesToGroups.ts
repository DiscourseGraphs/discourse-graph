import {
  CrossAppNode,
  CrossAppRelation,
  CrossAppRelationTripleSchema,
} from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { getAvailableGroupIds } from "@repo/database/lib/groups";
import { nodeUidsWithTypeToCrossApp } from "./roamToCrossAppConverters";
import {
  reifiedRelationToCrossApp,
  relationTripleSchemaToCrossApp,
  nodeSchemaToCrossApp,
} from "./roamToCrossAppConverters";
import getDiscourseRelations from "./getDiscourseRelations";
import { getReifiedRelations } from "./createReifiedBlock";
import {
  crossAppNodeSchemaToDbConcept,
  crossAppNodeToDbConcept,
  crossAppRelationToDbConcept,
  crossAppRelationTripleSchemaToDbConcept,
} from "@repo/database/lib/crossAppConverters";
import { ensurePartialSpaceAccess } from "@repo/database/lib/groups";
import { isIgnorableUpsertError } from "@repo/database/lib/contextFunctions";
import { getAllPages } from "@repo/database/lib/pagination";
import { isRid, ridToSpaceUriAndLocalId } from "@repo/database/lib/rid";
import getDiscourseNodes from "./getDiscourseNodes";
import { difference, intersection } from "@repo/utils/setOperations";
import internalError from "./internalError";
import { readImportedSourceIdentity } from "./importedSourceIdentity";
import { orderConceptsByDependency } from "./conceptConversion";
import { SOURCE_SLOT } from "./sourceSlot";
import getPageTitleByPageUid from "roamjs-components/queries/getPageTitleByPageUid";

export type NodeUidWithType = {
  uid: string;
  type: string;
};

export const getAllPublishedIdsByGroup = async ({
  client,
  spaceId,
  groupIds,
  sourceLocalIds,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  groupIds: string[];
  sourceLocalIds?: string[];
}): Promise<Record<string, Set<string>>> => {
  let query = client
    .from("ResourceAccess")
    .select("account_uid, source_local_id")
    .eq("space_id", spaceId)
    .in("account_uid", groupIds);
  if (sourceLocalIds) query = query.in("source_local_id", sourceLocalIds);
  const rows = await getAllPages(
    query.order("account_uid").order("source_local_id"),
    1000,
  );
  if (!Array.isArray(rows)) throw rows;
  const publishedIdsByGroupId = Object.fromEntries(
    groupIds.map((gid) => [gid, new Set<string>()]),
  );
  rows.forEach(({ account_uid, source_local_id }) => {
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
const isImportedFromSpaceUri = (nodeId: string): string | undefined => {
  const identity = readImportedSourceIdentity(nodeId);
  if (identity === undefined) return undefined;
  const { sourceNodeRid } = identity;
  const { spaceUri } = ridToSpaceUriAndLocalId(sourceNodeRid);
  return spaceUri;
};

export const gatherCorrespondingRelations = async ({
  client,
  spaceId,
  groupIds,
  forNodeIds,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  groupIds: string[];
  forNodeIds?: Set<string>;
}): Promise<{
  relations: CrossAppRelation[];
  relationTripleSchemas: CrossAppRelationTripleSchema[];
  relevantRelationIdsPerGroupId: Record<string, string[]>;
}> => {
  const allRelationsSchemas = getDiscourseRelations();
  const allRelationSchemasById = Object.fromEntries(
    allRelationsSchemas.map((s) => [s.id, s]),
  );
  const { spaceIdsByGroupId, spaceUrlById } = await getSpaceIdAndUrlsByGroupId(
    client,
    groupIds,
  );
  const spaceIdByUrl = Object.fromEntries(
    Object.entries(spaceUrlById).map(([id, url]) => [url, Number.parseInt(id)]),
  );
  // Should we even handle non-reified relations? Assuming not.
  // I need a way to know if a relation is imported, see importedFromSpaceId
  const allRelations = await getReifiedRelations();
  const spaceIdOfNodes: Record<string, number> = {};
  const isImportedFrom = (nodeLocalId: string): number => {
    let cached = spaceIdOfNodes[nodeLocalId];
    if (cached === undefined) {
      cached = spaceIdOfNodes[nodeLocalId] =
        spaceIdByUrl[isImportedFromSpaceUri(nodeLocalId) ?? ""] || spaceId;
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
  const publishedIdsByGroup = await getAllPublishedIdsByGroup({
    client,
    spaceId,
    groupIds,
  });
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
              (publishedIds.has(r.sourceUid) || // source already published
                (forNodeIds ? forNodeIds.has(r.sourceUid) : false) || // source will be published
                groupSpaceIds.has(isImportedFrom(r.sourceUid) || 0)) && // source imported from known space
              (publishedIds.has(r.destinationUid) || // destination already published
                (forNodeIds ? forNodeIds.has(r.destinationUid) : false) || // destination will be published
                groupSpaceIds.has(isImportedFrom(r.destinationUid) || 0)), // destination imported from known space
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

  return {
    relations: allRelevantRelations
      .map((r) => reifiedRelationToCrossApp(r))
      .filter((r) => r !== null),
    relationTripleSchemas: allRelationsSchemas
      .filter((rs3) => relationSchemaIds.has(rs3.id))
      .map((rs3) => relationTripleSchemaToCrossApp(rs3))
      .filter((rs3) => rs3 !== null),
    relevantRelationIdsPerGroupId,
  };
};

const onlyStrings = (values: (string | null)[]): string[] =>
  values.filter((value): value is string => typeof value === "string");

type PublishNodesResult = {
  publishedNodeSchemaUids: string[];
  publishedNodeUids: string[];
  publishedRelationTripleSchemaUids: string[];
  publishedRelationUids: string[];
  syncedNodeSchemaUids: string[];
  syncedRelationTripleSchemaUids: string[];
  syncedRelationUids: string[];
  failedUpsertUids: string[];
  okGroupIds: string[];
  failedGroupIds: string[];
};

// Grants a group access to discourse nodes by mirroring the Obsidian
// publish-to-group access model (SpaceAccess + ResourceAccess), without its
// file/frontmatter/asset coupling.
//
// ResourceAccess has no foreign key on source_local_id, so granting access to
// a node absent from this space would create an orphaned row. We therefore
// upsert every selected node as a complete concept (direct title + full
// content) before granting access, and withhold grants for anything whose
// upsert failed.
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
    publishedRelationTripleSchemaUids: [],
    publishedRelationUids: [],
    syncedNodeSchemaUids: [],
    syncedRelationUids: [],
    syncedRelationTripleSchemaUids: [],
    failedUpsertUids: [],
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

  const nodesByUid = new Map(nodes.map((node) => [node.localId, node]));
  let nodeUids = [...nodesByUid.keys()];
  const nodeSchemaUids = new Set(nodes.map((node) => node.nodeType));
  const nodeSchemas = getDiscourseNodes()
    .filter((s) => nodeSchemaUids.has(s.type))
    .map((s) => nodeSchemaToCrossApp(s))
    .filter((s) => s !== null);
  const { relations, relationTripleSchemas, relevantRelationIdsPerGroupId } =
    await gatherCorrespondingRelations({
      client,
      spaceId,
      groupIds,
      forNodeIds: new Set(nodeUids),
    });

  const relationUids = relations.map((r) => r.localId);
  const relationTripleSchemaUids = relationTripleSchemas.map((r) => r.localId);

  const localSourceUids = new Set(
    nodes
      .map((node) => node.slots?.[SOURCE_SLOT])
      .filter((id): id is string => id !== undefined && !isRid(id)),
  );

  const neededUids = [
    ...nodeSchemaUids,
    ...relationTripleSchemaUids,
    ...relationUids,
    ...localSourceUids,
  ];

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
  const missingNodeSchemas = nodeSchemas.filter(
    (s) => !syncedUids.has(s.localId),
  );
  const missingRelationTripleSchemas = relationTripleSchemas.filter(
    (s) => !syncedUids.has(s.localId),
  );
  const missingRelations = relations.filter((r) => !syncedUids.has(r.localId));

  const omitMissingSource = (node: CrossAppNode): CrossAppNode => {
    const sourceId = node.slots?.[SOURCE_SLOT];
    if (
      sourceId === undefined ||
      isRid(sourceId) ||
      nodesByUid.has(sourceId) ||
      syncedUids.has(sourceId)
    )
      return node;
    console.warn(
      `Source "${getPageTitleByPageUid(sourceId)}" (${sourceId}) is not in this space yet; publishing "${node.content.direct.value}" without it.`,
    );
    return { ...node, slots: undefined };
  };

  const { ordered: upsertConcepts } = orderConceptsByDependency(
    [
      ...missingNodeSchemas.map((s) => crossAppNodeSchemaToDbConcept(s)),
      ...[...nodesByUid.values()].map((node) =>
        crossAppNodeToDbConcept(omitMissingSource(node)),
      ),
      ...missingRelationTripleSchemas.map((rs3) =>
        crossAppRelationTripleSchemaToDbConcept(rs3),
      ),
      ...missingRelations.map((r) => crossAppRelationToDbConcept(r)),
    ].filter((r) => r !== undefined),
  );

  const upsertedNodeUids = new Set(nodeUids);
  const syncedRelationUids = new Set(missingRelations.map((s) => s.localId));
  const syncedRelationTripleSchemaUids = new Set(
    missingRelationTripleSchemas.map((s) => s.localId),
  );
  const syncedNodeSchemaUids = new Set(
    missingNodeSchemas.map((s) => s.localId),
  );

  const response = await client.rpc("upsert_concepts", {
    v_space_id: spaceId,
    data: upsertConcepts,
  });
  if (response.error) {
    internalError({ error: response.error });
    return result;
  }

  response.data.forEach((v, i) => {
    if (v < 0) {
      const localId = upsertConcepts[i].source_local_id;
      if (localId) {
        if (syncedNodeSchemaUids.has(localId)) {
          syncedNodeSchemaUids.delete(localId);
          nodeSchemaUids.delete(localId);
        } else if (upsertedNodeUids.has(localId)) {
          upsertedNodeUids.delete(localId);
        } else if (syncedRelationTripleSchemaUids.has(localId)) {
          syncedRelationTripleSchemaUids.delete(localId);
        } else if (syncedRelationUids.has(localId)) {
          syncedRelationUids.delete(localId);
        }
        result.failedUpsertUids.push(localId);
      }
    }
  });
  for (const node of nodesByUid.values()) {
    if (
      !nodeSchemaUids.has(node.nodeType) &&
      upsertedNodeUids.has(node.localId)
    ) {
      upsertedNodeUids.delete(node.localId);
      result.failedUpsertUids.push(node.localId);
    }
  }
  result.syncedNodeSchemaUids = [...syncedNodeSchemaUids];
  result.syncedRelationTripleSchemaUids = [...syncedRelationTripleSchemaUids];
  result.syncedRelationUids = [...syncedRelationUids];
  nodeUids = [...upsertedNodeUids];
  const failedUpsertIds = new Set(result.failedUpsertUids);

  const resourceAccesses = [];
  const resourceIds = [...nodeUids, ...nodeSchemaUids];
  for (const groupId of groupIds) {
    let groupRelationIds = new Set(relevantRelationIdsPerGroupId[groupId]);
    const groupRelations = relations.filter(
      (r) =>
        groupRelationIds.has(r.localId) &&
        !failedUpsertIds.has(r.localId) &&
        !failedUpsertIds.has(r.source) &&
        !failedUpsertIds.has(r.destination),
    );
    groupRelationIds = new Set(groupRelations.map((r) => r.localId));
    const groupRelationTripleSchemaIds = new Set(
      groupRelations
        .map((r) => r.relationType)
        .filter((r) => !failedUpsertIds.has(r)),
    );
    const groupResourceIds = [
      ...resourceIds,
      ...groupRelationIds,
      ...groupRelationTripleSchemaIds,
    ];
    resourceAccesses.push(
      ...groupResourceIds.map((sourceLocalId) => ({
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
    result.failedGroupIds.push(...groupIds);
    return result;
  }

  result.okGroupIds = groupIds;
  result.publishedRelationTripleSchemaUids = relationTripleSchemaUids;
  result.publishedRelationUids = relationUids;
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
