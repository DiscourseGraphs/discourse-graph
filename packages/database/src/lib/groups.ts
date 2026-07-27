import type { DGSupabaseClient } from "./client";

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
