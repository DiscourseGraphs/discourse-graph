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

/**
 * Fetches space IDs for multiple space URLs in a single query.
 * Returns a map of spaceUri -> spaceId; missing or failed lookups are omitted.
 */
export const getSpaceIdsBySpaceUris = async (
  client: DGSupabaseClient,
  spaceUris: string[],
): Promise<Map<string, number>> => {
  const unique = [...new Set(spaceUris)].filter(Boolean);
  if (unique.length === 0) return new Map();

  const { data, error } = await client
    .from("Space")
    .select("id, url")
    .in("url", unique);

  if (error) {
    console.error("Error fetching space IDs by URLs:", error);
    return new Map();
  }

  const map = new Map<string, number>();
  for (const row of data ?? []) {
    if (row?.url != null && typeof row.id === "number") {
      map.set(row.url, row.id);
    }
  }
  return map;
};
