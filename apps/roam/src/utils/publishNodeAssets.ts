import type { CrossAppNode } from "@repo/database/crossAppContracts";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { findAssetReferences } from "./findAssetReferences";
import {
  copyAssetToSharedStorage,
  type CopiedAsset,
  type SkippedAsset,
} from "./copyAssetToSharedStorage";

/**
 * The publish stage that copies each node's assets into shared storage.
 *
 * Runs after the content upsert, not alongside it: `FileReference` has a foreign key to
 * `Content`, so the row it hangs off has to exist first.
 *
 * The node's `full` markdown is read, never written. Publication leaves every asset link
 * exactly as the page wrote it, which is what lets the link keep serving as the reference
 * a destination matches on, and as the fallback when an asset could not be copied.
 *
 * Each node's existing references are read once, up front, and drive both halves of
 * keeping them in step with the content: a reference already recorded is left alone
 * without touching the network, and a recorded reference the content no longer makes is
 * deleted. Without the first, a re-publish re-downloads every asset of every node; without
 * the second, a destination imports assets the published content stopped mentioning.
 */

export type FailedAsset = {
  status: "failed";
  sourceRef: string;
  sourceLocalId: string;
  error: string;
};

/** A reference already recorded against this node, left as it stands. */
export type UnchangedAsset = {
  status: "unchanged";
  sourceRef: string;
  contentHash: string;
  sourcePath: string | undefined;
};

export type NodeAssetResult = (
  | CopiedAsset
  | SkippedAsset
  | FailedAsset
  | UnchangedAsset
) & {
  sourceLocalId: string;
};

type ExistingReference = { filehash: string; sourcePath: string | null };

/** What is already recorded, per node, keyed by the reference token in `filepath`. */
type ExistingReferences = Map<string, Map<string, ExistingReference>>;

/**
 * Reads every publishing node's references in one query, rather than one per node: the
 * common case is a re-publish where nothing has changed, and that should not cost a round
 * trip per node.
 */
const readExistingReferences = async ({
  client,
  spaceId,
  sourceLocalIds,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  sourceLocalIds: string[];
}): Promise<ExistingReferences> => {
  const { data, error } = await client
    .from("my_file_references")
    .select("source_local_id, filepath, filehash, source_path")
    .eq("space_id", spaceId)
    .in("source_local_id", sourceLocalIds);
  // A Postgrest error is a plain object, so it has to be wrapped or it reaches the
  // result as "[object Object]".
  if (error) throw new Error(error.message);

  const byNode: ExistingReferences = new Map();
  for (const row of data) {
    // The view's columns are all nullable to the type generator, though the table's are
    // not. A row missing any of these cannot be matched against a reference anyway.
    if (
      row.source_local_id === null ||
      row.filepath === null ||
      row.filehash === null
    )
      continue;
    const forNode =
      byNode.get(row.source_local_id) ?? new Map<string, ExistingReference>();
    forNode.set(row.filepath, {
      filehash: row.filehash,
      sourcePath: row.source_path,
    });
    byNode.set(row.source_local_id, forNode);
  }
  return byNode;
};

/**
 * Drops references this node no longer makes.
 *
 * Keyed on what the current markdown says, not on what this run managed to copy: an
 * asset that is still referenced but failed to transfer keeps its row, because the
 * reference is still true and deleting it would send bytes we still want to the
 * collector on a transient network fault.
 */
const removeUnreferencedAssets = async ({
  client,
  spaceId,
  sourceLocalId,
  referenced,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  sourceLocalId: string;
  referenced: string[];
}): Promise<void> => {
  let cleanup = client
    .from("FileReference")
    .delete()
    .eq("space_id", spaceId)
    .eq("source_local_id", sourceLocalId);
  if (referenced.length) cleanup = cleanup.notIn("filepath", referenced);
  const { error } = await cleanup;
  // Cleanup never fails a publish; the node and its content are already through.
  if (error) console.error(error);
};

export const publishNodeAssets = async ({
  client,
  spaceId,
  nodes,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  nodes: CrossAppNode[];
}): Promise<NodeAssetResult[]> => {
  // Nothing is known about a node whose content did not come through, so it is left out
  // entirely: nothing copied for it, and nothing removed from it.
  const publishing = nodes.flatMap((node) => {
    const markdown = node.content.full?.value;
    return markdown === undefined
      ? []
      : [{ node, referenced: [...new Set(findAssetReferences(markdown))] }];
  });
  if (publishing.length === 0) return [];

  let existingByNode: ExistingReferences;
  try {
    existingByNode = await readExistingReferences({
      client,
      spaceId,
      sourceLocalIds: publishing.map(({ node }) => node.localId),
    });
  } catch (error) {
    // Without the existing rows we cannot tell a re-publish from a first one. Copying
    // anyway would be correct but wasteful, and removing anything would be unsafe.
    const message = error instanceof Error ? error.message : String(error);
    return publishing.flatMap(({ node, referenced }) =>
      referenced.map(
        (sourceRef): NodeAssetResult => ({
          status: "failed",
          sourceRef,
          sourceLocalId: node.localId,
          error: message,
        }),
      ),
    );
  }

  const results: NodeAssetResult[] = [];
  for (const { node, referenced } of publishing) {
    const existing =
      existingByNode.get(node.localId) ?? new Map<string, ExistingReference>();

    for (const assetUrl of referenced) {
      const recorded = existing.get(assetUrl);
      if (recorded !== undefined) {
        // A Roam storage URL names one immutable upload, because re-uploading a file
        // yields a fresh URL. A row under this URL therefore already holds these bytes.
        // Nothing to fetch, and no `last_modified` comparison to make.
        results.push({
          status: "unchanged",
          sourceRef: assetUrl,
          contentHash: recorded.filehash,
          sourcePath: recorded.sourcePath ?? undefined,
          sourceLocalId: node.localId,
        });
        continue;
      }
      // Only this node's rows are consulted, so two nodes embedding the same asset URL
      // each download it once. Resolving the second from the row the first wrote is the
      // `resolve-repeat-asset-references` proposal, which is post-v0. Do not solve it
      // with a byte cache: the fix is to widen this query by `filepath` and to add a
      // way to insert a reference row against a hash that is already known.
      try {
        const result = await copyAssetToSharedStorage({
          client,
          spaceId,
          sourceLocalId: node.localId,
          assetUrl,
          nodeCreated: node.createdAt,
          nodeLastModified: node.modifiedAt ?? node.createdAt,
        });
        results.push({ ...result, sourceLocalId: node.localId });
      } catch (error) {
        // One asset never fails its node: the link stays in the published markdown and
        // the failure is carried out in the result.
        results.push({
          status: "failed",
          sourceRef: assetUrl,
          sourceLocalId: node.localId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Only when there is actually something to drop. A first publish and an unchanged
    // re-publish both have nothing stale, which is the common case, and neither should
    // pay for a round trip that would delete nothing.
    const hasStaleReference = [...existing.keys()].some(
      (filepath) => !referenced.includes(filepath),
    );
    if (hasStaleReference)
      await removeUnreferencedAssets({
        client,
        spaceId,
        sourceLocalId: node.localId,
        referenced,
      });
  }
  return results;
};

export type AssetSummary = {
  /** References newly recorded, one per link copied, not one per blob. */
  copied: number;
  /** References already recorded, which cost no transfer. */
  unchanged: number;
  /**
   * Distinct content behind the copied references. Two nodes embedding the same image
   * copy twice and store once, so this is what actually landed in the bucket, and it is
   * an upper bound on new uploads: a re-publish reuses a blob already there.
   */
  distinctBlobs: number;
  /** Files declined for being over the cap. Their links stay in the published markdown. */
  tooLarge: SkippedAsset[];
  /** Files that could not be read from Roam's storage. Their links stay too. */
  failed: FailedAsset[];
};

/** One entry per distinct file, so a file embedded in three nodes is reported once. */
const byDistinctRef = <T extends { sourceRef: string }>(results: T[]): T[] => {
  const seen = new Set<string>();
  return results.filter(({ sourceRef }) => {
    if (seen.has(sourceRef)) return false;
    seen.add(sourceRef);
    return true;
  });
};

/**
 * Counts what the stage did, for a publish summary.
 *
 * Skips and failures are kept apart because they mean different things to whoever is
 * publishing: an oversized file is a decision they can act on, an unreadable one is a
 * fault. Neither stopped the node from publishing.
 */
export const summarizeAssetResults = (
  results: NodeAssetResult[],
): AssetSummary => ({
  copied: results.filter((r) => r.status === "copied").length,
  unchanged: results.filter((r) => r.status === "unchanged").length,
  distinctBlobs: new Set(
    results.flatMap((r) => (r.status === "copied" ? [r.contentHash] : [])),
  ).size,
  tooLarge: byDistinctRef(
    results.filter(
      (r): r is SkippedAsset & { sourceLocalId: string } =>
        r.status === "skipped",
    ),
  ),
  failed: byDistinctRef(
    results.filter(
      (r): r is FailedAsset & { sourceLocalId: string } =>
        r.status === "failed",
    ),
  ),
});
