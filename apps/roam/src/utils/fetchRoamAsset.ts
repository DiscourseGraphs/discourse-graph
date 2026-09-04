/**
 * Fetches one asset from Roam's storage, along with the name it was uploaded under.
 *
 * Roam's storage URL carries a random uid rather than the original file name
 * (`imgs/app/<graph>/lqP2ioVNC3.png`), so the name has to be read separately. Firebase
 * keeps it in the object's custom metadata, and requesting the same URL with `alt=media`
 * removed returns the object descriptor as JSON instead of the bytes. That read is cheap,
 * needs no Roam API, and also yields the size, so a caller can decide whether an asset is
 * worth downloading before downloading it.
 */

/** Where Roam records the uploaded name, alongside `file-type`. */
const UPLOADED_NAME_KEY = "file-name";

type FirebaseObjectDescriptor = {
  /** The full object path, e.g. "imgs/app/MAPLab/lqP2ioVNC3.png". */
  name?: string;
  contentType?: string;
  /** Firebase reports the byte count as a string, and may omit it or send null. */
  size?: string | null;
  timeCreated?: string;
  updated?: string;
  metadata?: Record<string, string>;
};

export type RoamAssetDescriptor = {
  /** The name the file was uploaded under, or the storage uid when Roam kept none. */
  filename: string;
  mimetype: string;
  /** Byte count, or undefined when the descriptor did not report one. */
  size: number | undefined;
  /** When Roam's storage recorded the object, where it reports them. */
  createdAt: Date | undefined;
  modifiedAt: Date | undefined;
};

const DEFAULT_MIMETYPE = "application/octet-stream";

/**
 * The same URL with `alt=media` removed, which returns the object descriptor rather than
 * the bytes. The download token is kept: it governs access to both.
 */
export const assetDescriptorUrl = (assetUrl: string): string => {
  const url = new URL(assetUrl);
  url.searchParams.delete("alt");
  return url.toString();
};

/**
 * The storage uid, used as the name when Roam recorded none. This is what Roam's own
 * `file.get` falls back to, so an asset with no metadata gets the same name here as it
 * would there.
 */
const storageUidFromPath = (objectPath: string): string => {
  const segments = decodeURIComponent(objectPath).split("/");
  return segments[segments.length - 1] ?? "";
};

const storageUidFromUrl = (assetUrl: string): string => {
  try {
    return storageUidFromPath(new URL(assetUrl).pathname);
  } catch {
    return "";
  }
};

const parseTimestamp = (value: string | undefined): Date | undefined => {
  if (value === undefined) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? undefined : parsed;
};

const describeAsset = (
  descriptor: FirebaseObjectDescriptor,
  assetUrl: string,
): RoamAssetDescriptor => {
  const uploadedName = descriptor.metadata?.[UPLOADED_NAME_KEY];
  const fallbackName =
    descriptor.name !== undefined
      ? storageUidFromPath(descriptor.name)
      : storageUidFromUrl(assetUrl);
  // Only a non-empty string is a size. `Number(null)` and `Number("")` are both 0, which
  // would read as "empty file" and wave an unmeasured asset past the pre-download cap.
  const rawSize = descriptor.size;
  const size =
    typeof rawSize === "string" && rawSize.trim() !== ""
      ? Number(rawSize)
      : NaN;
  return {
    filename: uploadedName || fallbackName,
    mimetype: descriptor.contentType || DEFAULT_MIMETYPE,
    size: Number.isFinite(size) ? size : undefined,
    createdAt: parseTimestamp(descriptor.timeCreated),
    modifiedAt: parseTimestamp(descriptor.updated),
  };
};

/**
 * Reads the object descriptor without transferring the file.
 *
 * Throws when the read fails. The publish stage catches per asset, so one unreadable
 * asset never fails its node.
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
  return describeAsset(descriptor, assetUrl);
};

/**
 * Downloads the bytes alone.
 *
 * Deliberately kept separate from `fetchAssetDescriptor` rather than composed with it:
 * the size cap is checked from the descriptor first, so an oversized asset's bytes never
 * cross the network. A function that read the descriptor and downloaded in one step would
 * foreclose that. Throws when the request fails.
 */
export const fetchAssetBytes = async (
  assetUrl: string,
): Promise<ArrayBuffer> => {
  const response = await fetch(assetUrl);
  if (!response.ok)
    throw new Error(`Could not fetch asset (${response.status}): ${assetUrl}`);
  return response.arrayBuffer();
};
