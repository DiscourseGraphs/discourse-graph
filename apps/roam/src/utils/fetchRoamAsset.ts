/**
 * Reads one asset from Roam's storage, in two calls that answer different questions.
 *
 * `fetchAsset` goes through Roam's own `file.get`, which decrypts on encrypted graphs and
 * restores the name and type the file was uploaded under. A plain `fetch` of the URL
 * cannot do either: on an encrypted graph it returns ciphertext, correctly sized and
 * plausibly typed, which would be hashed and stored as though it were the file.
 *
 * Neither call subsumes the other, which is why they are separate and why collapsing them
 * would lose something.
 */

/** Where Roam records the uploaded name, alongside `file-type`. */
const UPLOADED_NAME_KEY = "file-name";

const DEFAULT_MIMETYPE = "application/octet-stream";

type FirebaseObjectDescriptor = {
  /** Firebase reports the byte count as a string, and may omit it or send null. */
  size?: string | null;
  timeCreated?: string;
  updated?: string;
  metadata?: Record<string, string>;
};

/** An asset as Roam hands it back, with the identity Roam restored for it. */
export type RoamAsset = {
  content: ArrayBuffer;
  /** The name the file was uploaded under, or the storage uid when Roam kept none. */
  filename: string;
  mimetype: string;
};

/**
 * What Firebase records about the stored object, as opposed to what the file is.
 *
 * Deliberately carries no MIME type and no resolved name: `file.get` resolves both.
 * `filename` is whatever Roam recorded, with no fallback, and labels an asset we decline
 * to download rather than one we store.
 */
export type RoamAssetDescriptor = {
  filename: string | undefined;
  /** Byte count, or undefined when the descriptor did not report one. */
  size: number | undefined;
  /** When Roam's storage recorded the object, where it reports them. */
  createdAt: Date | undefined;
  modifiedAt: Date | undefined;
};

/**
 * The same URL with `alt=media` removed, which returns the object descriptor rather than
 * the bytes. The download token is kept: it governs access to both.
 */
export const assetDescriptorUrl = (assetUrl: string): string => {
  const url = new URL(assetUrl);
  url.searchParams.delete("alt");
  return url.toString();
};

const parseTimestamp = (value: string | undefined): Date | undefined => {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
};

/**
 * Only a non-empty string is a size. `Number(null)` and `Number("")` are both 0, which
 * would read as "empty file" and wave an unmeasured asset past the pre-download cap.
 */
const parseSize = (value: string | null | undefined): number | undefined => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const size = Number(value);
  return Number.isFinite(size) ? size : undefined;
};

/**
 * Reads the asset itself, through Roam.
 *
 * Roam's `file.get` validates the host of the URL but not the bucket, so it must only be
 * handed URLs that have already been recognised as assets; it decides nothing about
 * whether a URL is one. Throws when Roam cannot read the asset, naming it, because the
 * publish stage catches per asset and one unreadable asset never fails its node.
 */
export const fetchAsset = async (assetUrl: string): Promise<RoamAsset> => {
  let file: File;
  try {
    file = await window.roamAlphaAPI.file.get({ url: assetUrl });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not fetch asset (${reason}): ${assetUrl}`);
  }
  return {
    content: await file.arrayBuffer(),
    filename: file.name,
    // A browser leaves `type` empty for a type it cannot name, and Supabase needs one.
    mimetype: file.type || DEFAULT_MIMETYPE,
  };
};

/**
 * Reads the object descriptor without transferring the file.
 *
 * `File.lastModified` is no substitute: `file.get` builds a `File` without one, so it
 * reports the time of the call. These do not move — Roam mints a fresh uid per upload and
 * never overwrites — and the importer's mirror check needs a value that does not.
 */
export const fetchAssetDescriptor = async (
  assetUrl: string,
): Promise<RoamAssetDescriptor> => {
  const response = await fetch(assetDescriptorUrl(assetUrl));
  if (!response.ok)
    throw new Error(
      `Could not read asset descriptor (${response.status}): ${assetUrl}`,
    );
  const descriptor = (await response.json()) as FirebaseObjectDescriptor;
  return {
    filename: descriptor.metadata?.[UPLOADED_NAME_KEY],
    size: parseSize(descriptor.size),
    createdAt: parseTimestamp(descriptor.timeCreated),
    modifiedAt: parseTimestamp(descriptor.updated),
  };
};
