/**
 * Finds the assets a node's `full` markdown references, so the publisher can copy their
 * bytes into shared storage.
 *
 * Roam addresses assets by URL, and the markdown is never rewritten at publication. What
 * this returns is therefore exactly what lands in `FileReference.filepath` and in
 * `CrossAppAsset.sourceRef`.
 */

/** Roam uploads land in its own Firebase project, which we do not control. */
const ROAM_STORAGE_HOST = "firebasestorage.googleapis.com";
const ROAM_STORAGE_BUCKET = "firescript-577a2.appspot.com";

const URL_PATTERN = String.raw`https?://[^\s<>()\[\]{}"']+`;

/**
 * The forms Roam writes an uploaded file in. `file.upload` returns a media-type-dependent
 * block string, so one asset can appear as any of these; a plain markdown link covers a
 * file a user linked rather than embedded.
 *
 * Ordered, and matched in one pass, so a URL inside an embed is never also counted as a
 * bare URL. Every branch captures the URL, and exactly one group is defined per match.
 */
const ASSET_REFERENCE_PATTERN = new RegExp(
  [
    String.raw`!\[[^\]]*\]\((${URL_PATTERN})\)`, // ![](url) image embed
    String.raw`\{\{\[\[(?:pdf|audio|video)\]\]:\s*(${URL_PATTERN})\s*\}\}`, // {{[[pdf]]: url}}
    String.raw`\{\{(?:pdf|audio|video):\s*(${URL_PATTERN})\s*\}\}`, // {{pdf: url}}
    String.raw`\[[^\]]*\]\((${URL_PATTERN})\)`, // [label](url) plain link
    `(${URL_PATTERN})`, // a bare URL, which Roam renders as a link
  ].join("|"),
  "g",
);

/** Punctuation that ends a sentence rather than the URL it follows. */
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/**
 * Whether a URL points at Roam's own storage, and so at bytes this graph can fetch and
 * publish. Anything else (an image hotlinked from another site, a link to a paper) is a
 * resource that was never an asset of the node, and is left alone.
 *
 * Matching the bucket rather than the path shape: every Roam upload lands in this one
 * bucket, while the path (`imgs/app/<graph>/<uid>`) is Roam's to change.
 */
export const isRoamStorageUrl = (url: string): boolean => {
  try {
    const { hostname, pathname } = new URL(url);
    return (
      hostname === ROAM_STORAGE_HOST &&
      pathname.includes(`/${ROAM_STORAGE_BUCKET}/`)
    );
  } catch {
    return false;
  }
};

/**
 * The Roam-hosted assets referenced by `markdown`, deduplicated, in order of first
 * appearance. The same asset embedded twice is one asset to copy, and one row to write.
 */
export const findAssetReferences = (markdown: string): string[] => {
  const found = new Set<string>();
  for (const match of markdown.matchAll(ASSET_REFERENCE_PATTERN)) {
    const [, ...groups] = match;
    const captured = groups.find((group) => group !== undefined);
    if (captured === undefined) continue;
    const url = captured.replace(TRAILING_PUNCTUATION, "");
    if (isRoamStorageUrl(url)) found.add(url);
  }
  return [...found];
};
