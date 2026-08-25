import type { DGSupabaseClient } from "./client";
import type { Tables, Enums } from "../dbTypes";
import { isIgnorableUpsertError } from "./contextFunctions";

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
