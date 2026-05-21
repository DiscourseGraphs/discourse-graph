import type { DGSupabaseClient } from "@repo/database/lib/client";

export const createGroup = async (
  client: DGSupabaseClient,
  name: string,
): Promise<string | null> => {
  const result = await client.functions.invoke<{ group_id: string }>(
    "create-group",
    { body: { name } },
  );
  return result.data?.group_id || null;
};
