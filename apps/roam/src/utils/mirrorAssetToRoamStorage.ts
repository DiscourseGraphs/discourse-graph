import {
  MAX_IMPORTED_ASSET_BYTES,
  isAssetTooLarge,
} from "@repo/database/lib/assetLimits";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { readMirroredAssetUrl, recordMirroredAsset } from "./assetRegistry";

/**
 * Copies one asset out of shared storage and into this graph's own Roam storage.
 *
 * Roam renders an embed by issuing an anonymous cross-origin GET, with no credentials,
 * so whatever an imported page points at has to be fetchable without our auth. Shared
 * storage is private, so the bytes have to land somewhere public: this graph's own
 * Firebase storage, through `file.upload`.
 *
 * Every asset takes this path, whatever platform published it. A Roam-origin asset
 * imported into a second graph is copied too, rather than pointing at the origin graph's
 * URL: recognising a Firebase URL in order to skip the copy would put origin detection
 * back into the destination, and the shortcut would leave this graph's page depending on
 * a blob the origin graph's owner can delete.
 *
 * The copy is irrevocable, and that is deliberate. See design.md Decision 3.
 */

/** The bucket `addFile` writes to, keyed by content hash. */
const SHARED_ASSET_BUCKET = "assets";

export type MirroredAsset = {
  /** The bytes were uploaded to this graph's storage by this call. */
  status: "mirrored";
  contentHash: string;
  url: string;
};

export type ReusedAsset = {
  /** This graph already held a copy, so nothing was uploaded. */
  status: "reused";
  contentHash: string;
  url: string;
};

export type SkippedAsset = {
  status: "skipped";
  contentHash: string;
  reason: "too-large";
  size: number;
  limit: number;
};

export type AssetMirrorResult = MirroredAsset | ReusedAsset | SkippedAsset;

/**
 * The forms `file.upload` resolves to. It returns a block string rather than a URL, and
 * which one depends on the media type, so the URL has to be unwrapped before it can be
 * recorded or written into a link.
 *
 * Anchored, because the input is one upload's return value rather than page content: a
 * pattern that matched loosely would take a URL out of a string this code does not
 * recognise, and recording the wrong URL is worse than reporting an unknown shape.
 */
const UPLOAD_RETURN_PATTERNS = [
  /^!\[[^\]]*\]\((\S+)\)$/, // an image
  /^\{\{\[\[(?:pdf|audio|video)\]\]:\s*(\S+?)\s*\}\}$/, // pdf, audio or video
  /^\{\{(?:pdf|audio|video):\s*(\S+?)\s*\}\}$/, // the same, written without brackets
  /^(https?:\/\/\S+)$/, // everything else, as a bare URL
];

export const extractUploadedUrl = (
  uploadReturn: string,
): string | undefined => {
  const trimmed = uploadReturn.trim();
  for (const pattern of UPLOAD_RETURN_PATTERNS) {
    const url = trimmed.match(pattern)?.[1];
    if (url) return url;
  }
  return undefined;
};

/**
 * An extension for the uploaded file, so Roam serves it as the type it is.
 *
 * Taken from the recorded name where there is one, since that is what the publisher saw,
 * and derived from the MIME subtype otherwise. Neither is guaranteed, and an asset with
 * no extension still uploads and still renders for the types Roam sniffs.
 */
const extensionFor = ({
  sourcePath,
  mimetype,
}: {
  sourcePath?: string | null;
  mimetype?: string;
}): string => {
  const leaf = sourcePath?.split("/").pop() ?? "";
  const dot = leaf.lastIndexOf(".");
  if (dot > 0) return leaf.slice(dot);

  // `image/svg+xml` carries its useful part before the `+`; anything else non-alphanumeric
  // is not an extension we should be inventing.
  const subtype = mimetype?.split("/")[1]?.split("+")[0] ?? "";
  return /^[a-z0-9]+$/i.test(subtype) ? `.${subtype}` : "";
};

/**
 * `imported-<sha256>`, which is what makes the registry a cache rather than a source of
 * truth: the hash travels with the file, so a lost registry can be rebuilt by reading
 * the names of the files a graph already holds. See design.md Decision 4.
 */
export const mirroredAssetFileName = ({
  contentHash,
  sourcePath,
  mimetype,
}: {
  contentHash: string;
  sourcePath?: string | null;
  mimetype?: string;
}): string =>
  `imported-${contentHash}${extensionFor({ sourcePath, mimetype })}`;

export const mirrorAssetToRoamStorage = async ({
  client,
  contentHash,
  sourcePath,
}: {
  client: DGSupabaseClient;
  contentHash: string;
  /** The name the reference records, used only to give the upload an extension. */
  sourcePath?: string | null;
}): Promise<AssetMirrorResult> => {
  const alreadyMirrored = readMirroredAssetUrl(contentHash);
  if (alreadyMirrored)
    return { status: "reused", contentHash, url: alreadyMirrored };

  const storage = client.storage.from(SHARED_ASSET_BUCKET);

  // Size is read from the object's metadata rather than from the downloaded bytes, so an
  // oversized asset costs one small request instead of the download this cap exists to
  // prevent. Where the metadata omits it, the check moves after the download.
  const { data: info, error: infoError } = await storage.info(contentHash);
  if (infoError) throw infoError;
  const tooLarge = (size: number): SkippedAsset => ({
    status: "skipped",
    contentHash,
    reason: "too-large",
    size,
    limit: MAX_IMPORTED_ASSET_BYTES,
  });
  if (
    info?.size !== undefined &&
    isAssetTooLarge({ size: info.size, limit: MAX_IMPORTED_ASSET_BYTES })
  )
    return tooLarge(info.size);

  const { data: blob, error: downloadError } =
    await storage.download(contentHash);
  if (downloadError) throw downloadError;
  if (!blob)
    throw new Error(`No bytes in shared storage for asset ${contentHash}`);
  if (isAssetTooLarge({ size: blob.size, limit: MAX_IMPORTED_ASSET_BYTES }))
    return tooLarge(blob.size);

  const mimetype = info?.contentType || blob.type || undefined;
  const file = new File(
    [blob],
    mirroredAssetFileName({ contentHash, sourcePath, mimetype }),
    mimetype ? { type: mimetype } : undefined,
  );

  // Upload first, then record. A placeholder written beforehand would carry no URL, so a
  // later run could neither reuse the upload nor find it, and Roam exposes no way to list
  // a graph's files. A crash between the two leaves one orphaned file, which is the
  // residue Roam's own documentation treats as normal. See design.md Decision 5.
  const uploadReturn = await window.roamAlphaAPI.file.upload({ file });
  const url = extractUploadedUrl(uploadReturn);
  if (!url)
    throw new Error(
      `Roam returned an upload result this code cannot read a URL from: ${uploadReturn}`,
    );

  await recordMirroredAsset({ contentHash, url });
  return { status: "mirrored", contentHash, url };
};
