import type { DGSupabaseClient } from "@repo/database/lib/client";
import { ridToSpaceUriAndLocalId } from "./rid";

export const getSpaceNameIdFromRid = async (
  client: DGSupabaseClient,
  rid: string,
): Promise<{ spaceName: string; spaceId: number }> => {
  const { spaceUri } = ridToSpaceUriAndLocalId(rid);
  const { data, error } = await client
    .from("Space")
    .select("name, id")
    .eq("url", spaceUri)
    .maybeSingle();

  if (error || !data) {
    console.error("Error fetching space name:", error);
    return { spaceName: "", spaceId: -1 };
  }

  return { spaceName: data.name, spaceId: data.id };
};
