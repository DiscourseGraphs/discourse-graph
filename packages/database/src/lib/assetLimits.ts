/**
 * Size caps for moving asset bytes across the shared-storage boundary.
 *
 * One cap per direction. They hold the same number today but answer different questions
 * and are expected to diverge, so neither is derived from the other, and neither is read
 * from a caller's own limit.
 */

/**
 * The largest asset a platform copies into shared storage when publishing a node.
 *
 * 6 MiB is Supabase's threshold for a standard upload; above it an uploader must switch
 * to a resumable one, which `addFile` does not implement. Deliberately not the bucket's
 * `file_size_limit` (50 MiB): the cap is on the upload method, not on the bucket.
 */
export const MAX_PUBLISHED_ASSET_BYTES = 6 * 1024 * 1024;

/**
 * The largest asset a destination copies out of shared storage when importing a node.
 *
 * Held separately because the constraint differs: the destination client pulls the bytes
 * down and pushes them back up, in the browser, once per importing graph, against that
 * user's storage quota. Each destination platform also imposes its own ceiling, so this
 * cap cannot be read off any one of them.
 */
export const MAX_IMPORTED_ASSET_BYTES = 6 * 1024 * 1024;

/**
 * Whether an asset is too large to transfer under `limit`.
 *
 * Returns a verdict rather than throwing: an oversized asset is a skip, and its node
 * still transfers with its content intact. Inclusive, so an asset exactly at `limit` is
 * skipped, matching the guard this replaced.
 */
export const isAssetTooLarge = ({
  size,
  limit,
}: {
  size: number;
  limit: number;
}): boolean => size >= limit;
