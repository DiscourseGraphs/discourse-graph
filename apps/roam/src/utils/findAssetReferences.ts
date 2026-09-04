/**
 * Finds the assets a node's `full` markdown references, so the publisher can copy their
 * bytes into shared storage.
 *
 * Roam addresses assets by URL, and the markdown is never rewritten at publication. What
 * this returns is therefore exactly what lands in `FileReference.filepath` and in
 * `CrossAppAsset.sourceRef`.
 */

/** Roam uploads land in Firebase Storage, in a project we do not control. */
const ROAM_STORAGE_HOST = "firebasestorage.googleapis.com";

/** Roam uploads to `imgs/app/<graph>/`. This is the part above the graph. */
const ASSET_FOLDER = ["imgs", "app"];

/** Separates the bucket from the object path in a Storage URL. */
const OBJECT_MARKER = "/o/";

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
 * The object this Storage URL addresses, decoded, as path segments. Empty when the URL
 * names no object.
 *
 * Firebase percent-encodes the object path (`/o/imgs%2Fapp%2FMAPLab%2Fx.png`), so the
 * separators only become separators after decoding.
 */
const objectSegments = (pathname: string): string[] => {
  const start = pathname.indexOf(OBJECT_MARKER);
  if (start === -1) return [];
  return decodeURIComponent(pathname.slice(start + OBJECT_MARKER.length)).split(
    "/",
  );
};

/**
 * Whether a URL points at an asset of *this* graph, and so at bytes we may copy.
 * Anything else is left alone: an image hotlinked from another site, a link to a paper,
 * or an asset belonging to another graph that arrived here on a pasted block.
 *
 * Matches the host and the `imgs/app/<graph>/` path, deliberately **not** the bucket:
 * the graph segment is what makes an asset ours. The accepted cost is that a URL shaped
 * like ours in a bucket we do not control is copied.
 *
 * The graph name is read per call rather than into a module constant, so that importing
 * this module has no `window` requirement.
 */
export const isRoamStorageUrl = (url: string): boolean => {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname !== ROAM_STORAGE_HOST) return false;
    const segments = objectSegments(pathname);
    const folder = segments.slice(0, ASSET_FOLDER.length);
    const graphName = segments[ASSET_FOLDER.length];
    const named = segments.slice(ASSET_FOLDER.length + 1);
    return (
      folder.join("/") === ASSET_FOLDER.join("/") &&
      // Exact, not case-insensitive: Roam preserves the graph name's casing in the URL.
      graphName === window.roamAlphaAPI.graph.name &&
      named.some((segment) => segment !== "")
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
