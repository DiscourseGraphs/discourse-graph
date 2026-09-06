import { addFile } from "@repo/database/lib/files";
import {
  MAX_PUBLISHED_ASSET_BYTES,
  isAssetTooLarge,
} from "@repo/database/lib/assetLimits";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { fetchAssetBytes, fetchAssetDescriptor } from "./fetchRoamAsset";

/**
 * Copies one Roam asset into shared storage, recording it against the node that
 * references it.
 *
 * The markdown is never rewritten, so the URL that the page already holds is what lands
 * in `filepath` and is what a destination matches on. `addFile` hashes the bytes,
 * deduplicates through `file_exists`, and resolves a repeated reference, so this does
 * none of that itself.
 */

export type CopiedAsset = {
  status: "copied";
  /** The URL as the markdown holds it. */
  sourceRef: string;
  /** SHA-256 of the stored bytes, as returned by `addFile`. */
  contentHash: string;
  /** The name Roam holds for the asset. */
  sourcePath: string;
};

export type SkippedAsset = {
  status: "skipped";
  sourceRef: string;
  sourcePath: string;
  reason: "too-large";
  size: number;
  limit: number;
};

export type AssetCopyResult = CopiedAsset | SkippedAsset;

export const copyAssetToSharedStorage = async ({
  client,
  spaceId,
  sourceLocalId,
  assetUrl,
  nodeCreated,
  nodeLastModified,
}: {
  client: DGSupabaseClient;
  spaceId: number;
  sourceLocalId: string;
  assetUrl: string;
  /** Used when Roam's storage reports no timestamps of its own. */
  nodeCreated: Date;
  nodeLastModified: Date;
}): Promise<AssetCopyResult> => {
  const descriptor = await fetchAssetDescriptor(assetUrl);
  const skip = (size: number): SkippedAsset => ({
    status: "skipped",
    sourceRef: assetUrl,
    sourcePath: descriptor.filename,
    reason: "too-large",
    size,
    limit: MAX_PUBLISHED_ASSET_BYTES,
  });

  // Decline an oversized asset from the descriptor alone, so its bytes never cross the
  // network. Where Roam reports no size, the check moves after the download.
  if (
    descriptor.size !== undefined &&
    isAssetTooLarge({ size: descriptor.size, limit: MAX_PUBLISHED_ASSET_BYTES })
  )
    return skip(descriptor.size);

  const content = await fetchAssetBytes(assetUrl);
  if (
    isAssetTooLarge({
      size: content.byteLength,
      limit: MAX_PUBLISHED_ASSET_BYTES,
    })
  )
    return skip(content.byteLength);

  const contentHash = await addFile({
    client,
    spaceId,
    sourceLocalId,
    fname: assetUrl,
    sourcePath: descriptor.filename,
    mimetype: descriptor.mimetype,
    created: descriptor.createdAt ?? nodeCreated,
    lastModified: descriptor.modifiedAt ?? nodeLastModified,
    content,
  });

  return {
    status: "copied",
    sourceRef: assetUrl,
    contentHash,
    sourcePath: descriptor.filename,
  };
};
