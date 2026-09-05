import {
  MAX_IMPORTED_ASSET_BYTES,
  isAssetTooLarge,
} from "@repo/database/lib/assetLimits";
import type { DGSupabaseClient } from "@repo/database/lib/client";
import { readMirroredAssetUrl, recordMirroredAsset } from "./assetRegistry";
import { getErrorMessage } from "./getErrorMessage";

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
 *
 * **Call this one asset at a time.** What makes it idempotent is a synchronous registry
 * read separated from the matching write by a download and an upload, so callers running
 * it under `Promise.all` all see an empty registry for the same hash: the bytes upload
 * once per call, the registry keeps one URL, and the rest are permanent orphans in the
 * user's Roam storage. `assetRegistry.ts` prices in a write lost between two tabs, which
 * costs one redundant upload; this is the larger cost, and the mitigation is the caller's
 * sequential loop rather than a lock here. Parallelising a caller means adding an
 * in-flight map of hash to promise in this module first.
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

export type SkippedMirror = {
  status: "skipped";
  contentHash: string;
  reason: "too-large";
  size: number;
  limit: number;
};

export type AssetMirrorResult = MirroredAsset | ReusedAsset | SkippedMirror;

/**
 * The forms `file.upload` resolves to. It returns a block string rather than a URL, and
 * which one depends on the media type, so the URL has to be unwrapped before it can be
 * recorded or written into a link.
 *
 * Anchored, and every branch requires the scheme: the input is one upload's return value
 * rather than page content, so a pattern that matched loosely would take a non-URL out of
 * a string this code does not recognise, and recording the wrong URL is worse than
 * reporting an unknown shape.
 *
 * Two branches are tolerance rather than observation. `file.upload` has been seen to
 * return `![](url)` for an image, the bracketed `{{[[pdf]]: url}}` family for those types,
 * and a bare URL for everything else (design.md Decision 4); the bracket-less embed and
 * the labelled link are shapes Roam writes elsewhere and could plausibly return. They
 * stay because the trade is asymmetric, and worse than asymmetric: an unreadable return
 * arrives *after* the bytes are uploaded, so it costs an orphaned file in the user's
 * storage as well as an unresolved asset, and every retry orphans another.
 */
const UPLOADED_URL = String.raw`(https?://\S+?)`;

const UPLOAD_RETURN_PATTERNS = [
  new RegExp(String.raw`^!\[[^\]]*\]\(${UPLOADED_URL}\)$`), // an image
  new RegExp(
    String.raw`^\{\{\[\[(?:pdf|audio|video)\]\]:\s*${UPLOADED_URL}\s*\}\}$`,
  ),
  new RegExp(String.raw`^\{\{(?:pdf|audio|video):\s*${UPLOADED_URL}\s*\}\}$`),
  new RegExp(String.raw`^\[[^\]]*\]\(${UPLOADED_URL}\)$`), // a labelled link
  new RegExp(String.raw`^${UPLOADED_URL}$`), // everything else, as a bare URL
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
const EXTENSION_CHARACTERS = /^[a-z0-9]+$/i;

const extensionFor = ({
  sourcePath,
  mimetype,
}: {
  sourcePath?: string | null;
  mimetype?: string;
}): string => {
  const leaf = sourcePath?.split("/").pop() ?? "";
  const dot = leaf.lastIndexOf(".");
  // A dot in the stem is not an extension: `2024.06.01 meeting` would otherwise upload as
  // `.06.01 meeting`. Anything that does not look like an extension falls through to the
  // MIME type, which is the better guess precisely in that case.
  const named = dot > 0 ? leaf.slice(dot + 1) : "";
  if (EXTENSION_CHARACTERS.test(named)) return `.${named}`;

  // `image/svg+xml` carries its useful part before the `+`; anything else non-alphanumeric
  // is not an extension we should be inventing.
  const subtype = mimetype?.split("/")[1]?.split("+")[0] ?? "";
  return EXTENSION_CHARACTERS.test(subtype) ? `.${subtype}` : "";
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
  //
  // An info failure is metadata this object does not carry, not a reason to abort: the
  // pre-check is only an optimisation, and the post-download check enforces the cap on
  // its own. Where info fails for a reason that matters — a missing object, a policy that
  // denies reads — the download fails next and reports it there.
  const { data: info } = await storage.info(contentHash);
  const tooLarge = (size: number): SkippedMirror => ({
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
  // One import mirrors one file per distinct hash across every node it brings in, so the
  // default per-upload toast would fire dozens of times at a user who asked for one
  // import. The import reports what it did; Roam does not need to narrate each file.
  const uploadReturn = await window.roamAlphaAPI.file.upload({
    file,
    toast: { hide: true },
  });
  const url = extractUploadedUrl(uploadReturn);
  if (!url)
    throw new Error(
      `Roam returned an upload result this code cannot read a URL from: ${uploadReturn}`,
    );

  // Best-effort, and never fatal. The bytes are in this graph's storage and the URL is in
  // hand, so failing here would report a copy that plainly succeeded as a failure, leave
  // the page on the published token, and re-upload the same file on the next run. What a
  // failed write actually costs is one redundant upload later, which is the price of the
  // registry being a cache rather than a source of truth.
  try {
    await recordMirroredAsset({ contentHash, url });
  } catch (error) {
    console.warn(
      `Copied an asset into this graph but could not record it in the asset registry, so it will be uploaded again on the next import: ${getErrorMessage(error)}`,
    );
  }
  return { status: "mirrored", contentHash, url };
};
