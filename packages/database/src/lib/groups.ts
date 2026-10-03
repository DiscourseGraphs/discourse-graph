import type { DGSupabaseClient } from "./client";
import type { Tables, Enums } from "../dbTypes";
import { isIgnorableUpsertError } from "./contextFunctions";
import { ridToSpaceUriAndLocalId } from "./rid";

export type MyGroup = {
  id: string;
  name: string;
};

export const getAvailableGroupIds = async (
  client: DGSupabaseClient,
): Promise<string[]> => {
  const { data, error } = await client
    .from("group_membership")
    .select("group_id")
    .eq("member_id", (await client.auth.getUser()).data.user?.id || "");

  if (error) {
    console.error("Error fetching groups:", error);
    throw new Error(`Failed to fetch groups: ${error.message}`);
  }

  return (data || []).map((g) => g.group_id);
};

export const getMyGroups = async (
  client: DGSupabaseClient,
): Promise<MyGroup[]> => {
  const userId = (await client.auth.getUser()).data.user?.id ?? "";
  const { data, error } = await client
    .from("group_membership")
    .select("group_id, my_groups!group_id(name)")
    .eq("member_id", userId);

  if (error) {
    console.error("Error fetching groups:", error);
    throw new Error(`Failed to fetch groups: ${error.message}`);
  }

  return (data ?? [])
    .filter(
      (row): row is { group_id: string; my_groups: { name: string | null } } =>
        typeof row.group_id === "string" &&
        row.my_groups !== null &&
        typeof row.my_groups === "object",
    )
    .map((row) => ({
      id: row.group_id,
      name: row.my_groups.name ?? row.group_id,
    }));
};

type SpaceAccessPermissions = Enums<"SpaceAccessPermissions">;

export const ensurePartialSpaceAccess = async ({
  client,
  groupIds,
  spaceId,
}: {
  client: DGSupabaseClient;
  groupIds: string[];
  spaceId: number;
}): Promise<{
  existing: Record<number, SpaceAccessPermissions>;
  missing?: Record<number, SpaceAccessPermissions>;
}> => {
  const existingAccessResult = await client
    .from("SpaceAccess")
    .select()
    .eq("space_id", spaceId)
    .in("account_uid", groupIds);
  const existingAccessByGroupId = existingAccessResult.data
    ? Object.fromEntries(
        existingAccessResult.data.map((sa) => [sa.account_uid, sa.permissions]),
      )
    : {};
  const missingAccess: Tables<"SpaceAccess">[] = [];
  for (const groupId of groupIds) {
    if (existingAccessByGroupId[groupId] === undefined) {
      missingAccess.push({
        space_id: spaceId,
        permissions: "partial",
        account_uid: groupId,
      });
    }
  }
  if (missingAccess.length > 0) {
    const upsertAccessResult = await client
      .from("SpaceAccess")
      .upsert(missingAccess, { ignoreDuplicates: true });
    if (!isIgnorableUpsertError(upsertAccessResult.error)) {
      // allow partial results
      return {
        existing: existingAccessByGroupId,
        missing: Object.fromEntries(
          missingAccess.map((a) => [a.account_uid, a.permissions]),
        ),
      };
    }
  }
  missingAccess.forEach((a) => {
    existingAccessByGroupId[a.account_uid] = "partial";
  });
  return { existing: existingAccessByGroupId };
};

// `.in()` filters go in the GET URL, which caps the local ids per batch.
const LOCAL_ID_BATCH_SIZE = 50;
// `max_rows` in supabase/config.toml. Past it, rows are dropped silently, so a
// batch's rows (local ids × groups) must stay under it.
const MAX_ROWS = 1000;

type SpaceSharing = {
  spaceId: number;
  fullAccessGroupIds: string[];
  partialAccessGroupIds: string[];
};

// Spaces share with groups by membership. Unlike SpaceAccess, whose select
// policy needs `reader`, this view shows `partial` pairs.
const getSpaceSharingByUrl = async ({
  client,
  spaceUris,
}: {
  client: DGSupabaseClient;
  spaceUris: string[];
}): Promise<Map<string, SpaceSharing>> => {
  const { data, error } = await client
    .from("my_pseudo_accounts")
    .select("space_id, group_id, sharing_permissions, Space!inner(url)")
    .in("Space.url", spaceUris)
    .not("sharing_permissions", "is", null);
  if (error) throw error;
  const sharingByUrl = new Map<string, SpaceSharing>();
  for (const {
    space_id: spaceId,
    group_id: groupId,
    sharing_permissions: permissions,
    Space: { url },
  } of data) {
    if (spaceId === null || groupId === null || permissions === null) continue;
    let sharing = sharingByUrl.get(url);
    if (!sharing) {
      sharing = { spaceId, fullAccessGroupIds: [], partialAccessGroupIds: [] };
      sharingByUrl.set(url, sharing);
    }
    if (permissions === "partial") sharing.partialAccessGroupIds.push(groupId);
    else sharing.fullAccessGroupIds.push(groupId);
  }
  return sharingByUrl;
};

const getGrantedGroupIdsByRid = async ({
  client,
  rids,
  sharingByUrl,
}: {
  client: DGSupabaseClient;
  rids: string[];
  sharingByUrl: Map<string, SpaceSharing>;
}): Promise<Map<string, string[]>> => {
  const partialRids = [...new Set(rids)].flatMap((rid) => {
    const { spaceUri, sourceLocalId } = ridToSpaceUriAndLocalId(rid);
    const sharing = sharingByUrl.get(spaceUri);
    return sharing?.partialAccessGroupIds.length
      ? [{ rid, sourceLocalId, sharing }]
      : [];
  });
  const groupCount = new Set(
    partialRids.flatMap(({ sharing }) => sharing.partialAccessGroupIds),
  ).size;
  const batchSize = Math.max(
    1,
    Math.min(LOCAL_ID_BATCH_SIZE, Math.floor(MAX_ROWS / groupCount)),
  );
  const groupIdsByRid = new Map<string, string[]>();
  for (let start = 0; start < partialRids.length; start += batchSize) {
    const batch = partialRids.slice(start, start + batchSize);
    const { data, error } = await client
      .from("ResourceAccess")
      .select("account_uid, space_id, source_local_id")
      .in("space_id", [...new Set(batch.map(({ sharing }) => sharing.spaceId))])
      .in("account_uid", [
        ...new Set(
          batch.flatMap(({ sharing }) => sharing.partialAccessGroupIds),
        ),
      ])
      .in("source_local_id", [
        ...new Set(batch.map(({ sourceLocalId }) => sourceLocalId)),
      ]);
    if (error) throw error;
    // Independent filters: a row can pair a local id with another space of
    // the batch, or with a group that is not `partial` there.
    const nodeByResource = new Map(
      batch.map((node) => [
        `${node.sharing.spaceId}/${node.sourceLocalId}`,
        node,
      ]),
    );
    for (const { account_uid, space_id, source_local_id } of data) {
      const node = nodeByResource.get(`${space_id}/${source_local_id}`);
      if (!node?.sharing.partialAccessGroupIds.includes(account_uid)) continue;
      groupIdsByRid.set(node.rid, [
        ...(groupIdsByRid.get(node.rid) ?? []),
        account_uid,
      ]);
    }
  }
  return groupIdsByRid;
};

// A group counts for a node with `reader` access or higher to its space, or
// with `partial` access and a ResourceAccess grant.
export const getPublishedGroupIdsByRid = async ({
  client,
  rids,
}: {
  client: DGSupabaseClient;
  rids: string[];
}): Promise<Record<string, string[]>> => {
  const result: Record<string, string[]> = Object.fromEntries(
    rids.map((rid) => [rid, []]),
  );
  if (rids.length === 0) return result;
  const spaceUriByRid = new Map(
    rids.map((rid) => [rid, ridToSpaceUriAndLocalId(rid).spaceUri]),
  );
  const sharingByUrl = await getSpaceSharingByUrl({
    client,
    spaceUris: [...new Set(spaceUriByRid.values())],
  });
  const grantedGroupIdsByRid = await getGrantedGroupIdsByRid({
    client,
    rids,
    sharingByUrl,
  });

  for (const [rid, spaceUri] of spaceUriByRid) {
    const sharing = sharingByUrl.get(spaceUri);
    if (!sharing) continue;
    result[rid] = [
      ...sharing.fullAccessGroupIds,
      ...(grantedGroupIdsByRid.get(rid) ?? []),
    ];
  }
  return result;
};
