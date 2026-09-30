import { addFile } from "@repo/database/lib/files";
import {
  MAX_ASSET_BYTES,
  isAssetTooLarge,
} from "@repo/database/lib/assetLimits";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { fetchAsset, fetchAssetDescriptor } from "./fetchRoamAsset";

/**
 * Copies one Roam asset into shared storage, recording it against the node that
 * references it.
 *
 * The markdown is never rewritten, so the URL that the page already holds is what lands
 * in `filepath` and is what a destination matches on. `addFile` hashes the bytes,
 * deduplicates through `file_exists`, and resolves a repeated reference, so this does
 * none of that itself.
 *
 * Reads each asset twice. `fetchRoamAsset` documents why neither read subsumes the other.
 */

export type CopiedAsset = {
  status: "copied";
  /** The URL as the markdown holds it. */
  sourceRef: string;
  /** SHA-256 of the stored bytes, as returned by `addFile`. */
  contentHash: string;
  /** The name Roam restored for the asset. */
  sourcePath: string;
};

export type SkippedAsset = {
  status: "skipped";
  sourceRef: string;
  /**
   * Undefined when the asset was declined before it was read: only `file.get` resolves a
   * name for an asset Roam recorded none for, and it is never called in that case.
   */
  sourcePath: string | undefined;
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
  const skip = ({
    size,
    sourcePath,
  }: {
    size: number;
    sourcePath: string | undefined;
  }): SkippedAsset => ({
    status: "skipped",
    sourceRef: assetUrl,
    sourcePath,
    reason: "too-large",
    size,
    limit: MAX_ASSET_BYTES,
  });

  // Decline an oversized asset from the descriptor alone, so its bytes never cross the
  // network. Not on an encrypted graph: there the descriptor measures the stored
  // ciphertext, which exceeds the file by an unknown factor, and the cap is about the
  // decrypted bytes that reach Supabase. Where the shortcut does not apply the check
  // simply moves after the download, which is what enforces the cap in every case.
  if (
    !window.roamAlphaAPI.graph.isEncrypted &&
    descriptor.size !== undefined &&
    isAssetTooLarge(descriptor.size)
  )
    return skip({ size: descriptor.size, sourcePath: descriptor.filename });

  const asset = await fetchAsset(assetUrl);
  if (isAssetTooLarge(asset.content.byteLength))
    return skip({
      size: asset.content.byteLength,
      sourcePath: asset.filename,
    });

  const contentHash = await addFile({
    client,
    spaceId,
    sourceLocalId,
    fname: assetUrl,
    sourcePath: asset.filename,
    mimetype: asset.mimetype,
    // Storage timestamps, not `File.lastModified`, which is the time of the call. The
    // node's own dates are the fallback, and are stable for the same reason.
    created: descriptor.createdAt ?? nodeCreated,
    lastModified: descriptor.modifiedAt ?? nodeLastModified,
    content: asset.content,
  });

  return {
    status: "copied",
    sourceRef: assetUrl,
    contentHash,
    sourcePath: asset.filename,
  };
};
