/**
 * The size cap for moving asset bytes across the shared-storage boundary.
 */

/**
 * The largest asset, in bytes, that we copy into or out of shared storage.
 *
 * Bounded by the minimum of what the platforms allow. 6 MiB is Supabase's threshold for
 * a standard upload, above which an uploader must switch to a resumable one that
 * `addFile` does not implement; Roam accepts 100 MB, and Obsidian imposes nothing.
 * Supabase binds, so one cap covers both publishing and importing. Deliberately not the
 * bucket's `file_size_limit` (50 MiB): the cap is on the upload method, not on the
 * bucket.
 *
 * A second cap would be needed only if this one rose above a destination's own ceiling,
 * and it would then belong to that destination platform rather than to a direction.
 */
export const MAX_ASSET_BYTES = 6 * 1024 * 1024;

/**
 * Whether an asset is too large to transfer.
 *
 * Returns a verdict rather than throwing: an oversized asset is a skip, and its node
 * still transfers with its content intact. Inclusive, so an asset exactly at the cap is
 * skipped, matching the guard this replaced.
 */
export const isAssetTooLarge = (size: number): boolean =>
  size >= MAX_ASSET_BYTES;
