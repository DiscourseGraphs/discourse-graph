/**
 * Size caps for moving asset bytes across the shared-storage boundary.
 *
 * The two directions are separate constants on purpose. They happen to hold the same
 * number today, but they answer different questions and are expected to diverge: the
 * publish cap is about what we will store and pay for, the import cap about what a
 * browser should shuttle and what it costs a user's quota on the destination platform.
 * Neither may be derived from the other, and neither may be imported from a caller's
 * own limit.
 */

/**
 * The largest asset, in bytes, that a platform will copy into shared storage when
 * publishing a node.
 *
 * 6 MiB is Supabase's threshold for a standard upload; above it an uploader is expected
 * to switch to a resumable one, which `addFile` does not implement. It is deliberately
 * not read from the bucket's own `file_size_limit` (50 MiB), because the constraint is
 * the upload method rather than what the bucket would accept.
 */
export const MAX_PUBLISHED_ASSET_BYTES = 6 * 1024 * 1024;

/**
 * The largest asset, in bytes, that a destination will copy out of shared storage into
 * its own storage when importing a node.
 *
 * Same number as the publish cap for now, so there is one figure to reason about, but
 * held separately because the constraint is different: the destination client pulls the
 * bytes down and pushes them back up, in the browser, once per importing graph, spending
 * that user's storage quota. The destination platform's own ceiling is unknown to us.
 */
export const MAX_IMPORTED_ASSET_BYTES = 6 * 1024 * 1024;

/**
 * Whether an asset is too large to transfer under the given cap.
 *
 * Returns a verdict rather than throwing: an oversized asset is a skip, and the node it
 * belongs to still publishes or imports with its content intact. The boundary is
 * inclusive, so an asset exactly at the cap is skipped, matching the guard this replaced.
 */
export const isAssetTooLarge = ({
  size,
  limit,
}: {
  size: number;
  limit: number;
}): boolean => size >= limit;
