/**
 * Rewrites the asset links in an imported node's markdown to point at this graph's own
 * copies.
 *
 * Resolution is by recorded row, never by origin. Each `FileReference` records the token
 * exactly as the publishing platform's content expressed it, so a token is rewritten when
 * a row matches it and left alone when none does. That one rule covers every case: a
 * genuinely external link has no row, and so does an asset whose bytes could not be
 * copied, which is why leaving the token untouched is also the degradation path.
 *
 * Nothing here inspects a token's shape to decide what to do with it. A Roam-origin token
 * is a storage URL and an Obsidian-origin token is a vault path, and this code does not
 * need to know which it is looking at.
 */

/** How Roam has to be told to render an asset, which is not the same for every type. */
type AssetKind = "image" | "pdf" | "audio" | "video" | "file";

export type ResolvedAsset = {
  /** The token as the published markdown holds it, from `FileReference.filepath`. */
  sourceRef: string;
  /** Where this graph's own copy lives. */
  url: string;
  /** The name the reference records, from `FileReference.source_path`. */
  sourcePath?: string | null;
  mimetype?: string;
};

const EXTENSION_KINDS: Record<string, AssetKind> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  svg: "image",
  bmp: "image",
  pdf: "pdf",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  mp4: "video",
  webm: "video",
  mov: "video",
};

const extensionOf = (path: string): string => {
  // A URL's query string is not part of its name: Roam storage URLs end in `?alt=media`.
  const leaf = path.split(/[?#]/)[0]?.split("/").pop() ?? "";
  const dot = leaf.lastIndexOf(".");
  return dot > 0 ? leaf.slice(dot + 1).toLowerCase() : "";
};

/**
 * What kind of asset this is, preferring the recorded MIME type over a guess from the
 * name. An unrecognised type is a `file`, which renders as a labelled link and is the
 * one form that works for anything.
 */
const kindOf = ({
  sourcePath,
  sourceRef,
  mimetype,
}: ResolvedAsset): AssetKind => {
  const [type, subtype] = mimetype?.split("/") ?? [];
  if (type === "image") return "image";
  if (type === "audio") return "audio";
  if (type === "video") return "video";
  if (subtype === "pdf") return "pdf";
  return (
    EXTENSION_KINDS[extensionOf(sourcePath ?? "")] ??
    EXTENSION_KINDS[extensionOf(sourceRef)] ??
    "file"
  );
};

/**
 * The label for an asset Roam renders as a link rather than as content.
 *
 * `file.upload` returns a bare URL for anything that is not an image, PDF, audio or
 * video, and a bare URL in a block renders as a link whose visible text is the URL: a
 * hundred characters of storage uid telling the reader nothing. This label is the only
 * place a user sees what an imported file is called.
 */
const labelFor = ({
  asset,
  linkText,
}: {
  asset: ResolvedAsset;
  linkText: string;
}): string => {
  const trimmed = linkText.trim();
  if (trimmed) return trimmed;
  const leaf = (asset.sourcePath ?? asset.sourceRef).split(/[?#]/)[0] ?? "";
  return leaf.split("/").pop() || asset.url;
};

const render = ({
  asset,
  linkText,
}: {
  asset: ResolvedAsset;
  linkText: string;
}): string => {
  switch (kindOf(asset)) {
    case "image":
      return `![${linkText.trim()}](${asset.url})`;
    case "pdf":
      return `{{[[pdf]]: ${asset.url}}}`;
    case "audio":
      return `{{[[audio]]: ${asset.url}}}`;
    case "video":
      return `{{[[video]]: ${asset.url}}}`;
    case "file":
      return `[${labelFor({ asset, linkText })}](${asset.url})`;
  }
};

/** A URL as it sits in content, stopping at the punctuation that encloses it. */
const URL_TOKEN = String.raw`https?://[^\s<>()\[\]{}"']+`;

/**
 * The link forms an imported node's markdown can express an asset in, matched in one pass
 * so that a token inside an embed is never also treated as a bare reference.
 *
 * Ordered. The media-embed branches precede the wikilink ones, or `{{[[pdf]]: url}}`
 * would be read as a page reference to `pdf` and its URL left behind as a bare token.
 * Roam writes a stored PDF in exactly that form, so this is the shape a Roam-origin
 * asset arrives in, not a hypothetical one.
 *
 * The wikilink branches carry Obsidian-origin notes. A Roam page reference is written the
 * same way, so it is matched too, but it can never resolve: a page name is not a recorded
 * token, and an unmatched token is left exactly as it was.
 */
const LINK_PATTERN = new RegExp(
  [
    String.raw`!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)`, // ![alt](token)
    String.raw`\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)`, // [label](token)
    String.raw`\{\{\[\[(?:pdf|audio|video)\]\]:\s*(${URL_TOKEN})\s*\}\}`, // {{[[pdf]]: url}}
    String.raw`\{\{(?:pdf|audio|video):\s*(${URL_TOKEN})\s*\}\}`, // {{pdf: url}}
    String.raw`!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]`, // ![[token]] or ![[token|alt]]
    String.raw`\[\[([^\]|]+)(?:\|[^\]]*)?\]\]`, // [[token]] or [[token|label]]
    `(${URL_TOKEN})`, // a bare URL, rewritten only when a row matches it
  ].join("|"),
  "g",
);

export const rewriteAssetLinks = ({
  markdown,
  assets,
}: {
  markdown: string;
  assets: ResolvedAsset[];
}): string => {
  if (!assets.length) return markdown;
  const byRef = new Map(assets.map((asset) => [asset.sourceRef, asset]));

  return markdown.replace(
    LINK_PATTERN,
    // One capture group per branch, in the order the pattern lists them. The trailing
    // offset and input arguments the replacer also receives are simply not destructured.
    (match: string, ...groups: (string | undefined)[]) => {
      const [
        imageAlt,
        imageRef,
        linkLabel,
        linkRef,
        bracketedMediaRef,
        mediaRef,
        embedRef,
        wikiRef,
        bareRef,
      ] = groups;
      const ref =
        imageRef ??
        linkRef ??
        bracketedMediaRef ??
        mediaRef ??
        embedRef ??
        wikiRef ??
        bareRef;
      if (ref === undefined) return match;
      const asset = byRef.get(ref);
      if (!asset) return match;

      // A wikilink embed carries no separate text, so its label comes from the asset.
      const linkText = imageRef ? (imageAlt ?? "") : (linkLabel ?? "");
      return render({ asset, linkText });
    },
  );
};
