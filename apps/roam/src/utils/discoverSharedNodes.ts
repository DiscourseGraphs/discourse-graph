import { spaceUriAndLocalIdToRid } from "@repo/database/lib/rid";
import type { DGSupabaseClient } from "@repo/database/lib/client";

export type DiscoveredSharedNode = {
  sourceApp: "roam" | "obsidian";
  sourceSpaceId: string;
  sourceSpaceName: string;
  sourceNodeId: string;
  sourceNodeRid: string;
  title: string;
  sourceModifiedAt: string;
  alreadyImported: boolean;
};

export type DiscoverableGroup = {
  id: string;
  name: string;
};

type DiscoveryContentRow = {
  source_local_id: string | null;
  space_id: number | null;
  text: string | null;
  last_modified: string | null;
  variant: string | null;
};

type SpaceMeta = {
  url: string;
  name: string | null;
  platform: string | null;
};

const platformToSourceApp = (
  platform: string | null,
): DiscoveredSharedNode["sourceApp"] | null => {
  if (platform === "Roam") return "roam";
  if (platform === "Obsidian") return "obsidian";
  return null;
};

const dbTimestampToIso = (value: string | null): string | null => {
  if (!value) return null;
  const ms = new Date(`${value}Z`).valueOf();
  return Number.isNaN(ms) ? null : new Date(ms).toISOString();
};

const latestModifiedIso = (rows: DiscoveryContentRow[]): string | null => {
  const stamps = rows
    .map((row) => row.last_modified)
    .filter((value): value is string => value != null);
  if (stamps.length === 0) return null;
  const latest = stamps.reduce((a, b) => (a >= b ? a : b));
  return dbTimestampToIso(latest);
};

/**
 * Assembles raw `my_contents` rows into app-neutral discovered nodes. Pure (no Supabase
 * or Roam access) so it can be unit-tested directly. A node is discoverable only when it
 * has a `full` markdown variant — the marker that the source app actually shared it
 * (ENG-1848) and therefore that it matches the shared cross-app contract.
 */
export const assembleDiscoveredNodes = ({
  contentRows,
  spaceMetaById,
  importedRids,
}: {
  contentRows: DiscoveryContentRow[];
  spaceMetaById: Map<number, SpaceMeta>;
  importedRids: Set<string>;
}): DiscoveredSharedNode[] => {
  const byNode = new Map<
    string,
    { spaceId: number; sourceNodeId: string; rows: DiscoveryContentRow[] }
  >();
  for (const row of contentRows) {
    if (row.source_local_id == null || row.space_id == null) continue;
    const key = `${row.space_id}\t${row.source_local_id}`;
    const existing = byNode.get(key);
    if (existing) existing.rows.push(row);
    else
      byNode.set(key, {
        spaceId: row.space_id,
        sourceNodeId: row.source_local_id,
        rows: [row],
      });
  }

  const nodes: DiscoveredSharedNode[] = [];
  for (const { spaceId, sourceNodeId, rows } of byNode.values()) {
    if (!rows.some((row) => row.variant === "full")) continue;

    const meta = spaceMetaById.get(spaceId);
    if (!meta) continue;
    const sourceApp = platformToSourceApp(meta.platform);
    if (!sourceApp) continue;

    const direct = rows.find((row) => row.variant === "direct");
    const full = rows.find((row) => row.variant === "full");
    const title = (direct?.text ?? full?.text ?? "").trim();
    if (!title) continue;

    const sourceNodeRid = spaceUriAndLocalIdToRid(meta.url, sourceNodeId);
    nodes.push({
      sourceApp,
      sourceSpaceId: meta.url,
      sourceSpaceName: meta.name ?? meta.url,
      sourceNodeId,
      sourceNodeRid,
      title,
      sourceModifiedAt: latestModifiedIso(rows) ?? new Date(0).toISOString(),
      alreadyImported: importedRids.has(sourceNodeRid),
    });
  }

  nodes.sort(
    (a, b) =>
      a.sourceSpaceName.localeCompare(b.sourceSpaceName) ||
      b.sourceModifiedAt.localeCompare(a.sourceModifiedAt) ||
      a.title.localeCompare(b.title),
  );
  return nodes;
};

const fetchSpaceMetaById = async (
  client: DGSupabaseClient,
  spaceIds: number[],
): Promise<Map<number, SpaceMeta>> => {
  const metaById = new Map<number, SpaceMeta>();
  if (spaceIds.length === 0) return metaById;

  const { data, error } = await client
    .from("my_spaces")
    .select("id, name, url, platform")
    .in("id", spaceIds);
  if (error) {
    throw new Error(`Failed to load source spaces: ${error.message}`);
  }

  for (const row of data ?? []) {
    if (row.id == null || row.url == null) continue;
    metaById.set(row.id, {
      url: row.url,
      name: row.name,
      platform: row.platform,
    });
  }
  return metaById;
};

export const discoverSharedNodes = async ({
  client,
  currentSpaceId,
  importedRids = new Set<string>(),
}: {
  client: DGSupabaseClient;
  currentSpaceId: number;
  importedRids?: Set<string>;
}): Promise<DiscoveredSharedNode[]> => {
  const { data, error } = await client
    .from("my_contents")
    .select("source_local_id, space_id, text, last_modified, variant")
    .neq("space_id", currentSpaceId);
  if (error) {
    throw new Error(`Failed to load shared nodes: ${error.message}`);
  }

  const contentRows = data ?? [];
  if (contentRows.length === 0) return [];

  const spaceIds = [
    ...new Set(
      contentRows
        .map((row) => row.space_id)
        .filter((value): value is number => value != null),
    ),
  ];
  const spaceMetaById = await fetchSpaceMetaById(client, spaceIds);
  return assembleDiscoveredNodes({ contentRows, spaceMetaById, importedRids });
};

export const getMyGroups = async (
  client: DGSupabaseClient,
): Promise<DiscoverableGroup[]> => {
  const { data, error } = await client.from("my_groups").select("id, name");
  if (error) {
    throw new Error(`Failed to load sharing groups: ${error.message}`);
  }
  return (data ?? []).flatMap((row) =>
    row.id == null ? [] : [{ id: row.id, name: row.name ?? row.id }],
  );
};
