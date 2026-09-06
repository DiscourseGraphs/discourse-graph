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

/**
 * Prototype-free, and read through `Object.hasOwn`: a token ending in `.constructor`
 * would otherwise look up a function, fail every `case` in `render`, and write the
 * literal string `undefined` into the user's page in place of their content.
 */
const EXTENSION_KINDS: Record<string, AssetKind> = Object.assign(
  Object.create(null) as Record<string, AssetKind>,
  {
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    webp: "image",
    svg: "image",
    bmp: "image",
    avif: "image",
    heic: "image",
    tiff: "image",
    ico: "image",
    pdf: "pdf",
    mp3: "audio",
    wav: "audio",
    ogg: "audio",
    m4a: "audio",
    flac: "audio",
    aac: "audio",
    mp4: "video",
    webm: "video",
    mov: "video",
    m4v: "video",
    mkv: "video",
    avi: "video",
  },
);

const kindForExtension = (extension: string): AssetKind | undefined =>
  Object.hasOwn(EXTENSION_KINDS, extension)
    ? EXTENSION_KINDS[extension]
    : undefined;

const extensionOf = (path: string): string => {
  // A URL's query string is not part of its name: Roam storage URLs end in `?alt=media`.
  const leaf = path.split(/[?#]/)[0]?.split("/").pop() ?? "";
  const dot = leaf.lastIndexOf(".");
  return dot > 0 ? leaf.slice(dot + 1).toLowerCase() : "";
};

/**
 * How the source markdown wrote the reference, which is evidence in its own right.
 *
 * `embed` is `![...]`, in any of its spellings, and `link` is `[...]`; a bare URL is
 * neither. Roam has one embed form and it is the image one, so a note that embedded
 * something said "render this as content" even when nothing else identifies the type.
 */
type ReferenceForm = "embed" | "link" | "bare";

/** How the reference was written, and what the source said it was, where it said so. */
type ReferenceContext = {
  form: ReferenceForm;
  /** From `{{[[pdf]]: url}}` and its bracket-less spelling, which name the type. */
  declaredKind?: AssetKind;
};

/**
 * What kind of asset this is, in decreasing order of how much the source committed to:
 * the recorded MIME type, the kind the markdown named outright, the extension on either
 * name, and finally the form it was written in. An unrecognised type is a `file`, which
 * renders as a labelled link and is the one form that works for anything.
 *
 * The form ranks last because it is the weakest evidence — `![...]` says "render this as
 * content", not "this is an image" — so it decides only where nothing else can: a token
 * carrying no extension, which is every Roam storage uid. Nothing populates `mimetype`
 * yet, so in practice the middle two do the work.
 */
const kindOf = (
  { sourcePath, sourceRef, mimetype }: ResolvedAsset,
  { form, declaredKind }: ReferenceContext,
): AssetKind => {
  const [type, subtype] = mimetype?.split("/") ?? [];
  if (type === "image") return "image";
  if (type === "audio") return "audio";
  if (type === "video") return "video";
  if (subtype === "pdf") return "pdf";

  // `{{[[pdf]]: url}}` is not a guess to be improved on: the source said what this is,
  // and a Roam storage uid carries no extension to check it against anyway.
  if (declaredKind) return declaredKind;

  const named =
    kindForExtension(extensionOf(sourcePath ?? "")) ??
    kindForExtension(extensionOf(sourceRef));
  if (named) return named;

  // Only where nothing names an extension. An embed of `report.docx` said "embed" but
  // never said "image", and treating it as one would assert a type the source contradicts
  // and drop the filename `labelFor` exists to show. An extension-less token has no such
  // claim to contradict, and there `![...]` is the only evidence available.
  const unnamed = !extensionOf(sourcePath ?? "") && !extensionOf(sourceRef);
  return form === "embed" && unnamed ? "image" : "file";
};

/**
 * The label for an asset Roam renders as a link rather than as content.
 *
 * `file.upload` returns a bare URL for anything that is not an image, PDF, audio or
 * video, and a bare URL in a block renders as a link whose visible text is the URL: a
 * hundred characters of storage uid telling the reader nothing. This label is the only
 * place a user sees what an imported file is called.
 *
 * One case has nothing better to offer: a bare storage URL whose row records no name, or
 * records the uid itself because the descriptor carried no `file-name`. There is no MIME
 * type, no declared kind, no extension, and a bare URL states no intent, so the label
 * comes out as the uid leaf — shorter than the URL, and that is all. It resolves itself
 * the moment anything populates `mimetype`, which is the reason that field exists on
 * `ResolvedAsset` while nothing writes it yet.
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
  // `||`, not `??`: an empty recorded name is no name, and falling through to the token
  // is what the chain is for. With `??` the label would come out as the storage URL,
  // which is exactly what this function exists to avoid.
  const leaf = (asset.sourcePath || asset.sourceRef).split(/[?#]/)[0] ?? "";
  return leaf.split("/").pop() || asset.url;
};

const render = ({
  asset,
  linkText,
  context,
}: {
  asset: ResolvedAsset;
  linkText: string;
  context: ReferenceContext;
}): string => {
  const kind = kindOf(asset, context);

  // A note that wrote `[Figure 3](image)` chose a link over an embed, and Roam shows no
  // alt text, so embedding it would delete the only words the reader sees. An embed, a
  // bare URL, and a link with nothing in its brackets all have no text to lose.
  if (kind === "image" && context.form === "link" && linkText.trim())
    return `[${linkText.trim()}](${asset.url})`;

  switch (kind) {
    case "image":
      return `![${linkText.trim()}](${asset.url})`;
    case "pdf":
      return `{{[[pdf]]: ${asset.url}}}`;
    case "audio":
      return `{{[[audio]]: ${asset.url}}}`;
    case "video":
      return `{{[[video]]: ${asset.url}}}`;
    case "file":
    default:
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
    // No `[` in the label, so `[![alt](image)](link)` cannot match here from the outer
    // bracket: the branch fails, the scan advances one character, and the image branch
    // takes the inner embed as it should. Alternation is tried per position, so ordering
    // the image branch first is not enough on its own.
    String.raw`\[([^\]\[]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)`, // [label](token)
    // The media keyword is captured, not discarded: it is the source stating the type,
    // and it is the only statement available for a storage uid with no extension.
    String.raw`\{\{\[\[(pdf|audio|video)\]\]:\s*(${URL_TOKEN})\s*\}\}`, // {{[[pdf]]: url}}
    String.raw`\{\{(pdf|audio|video):\s*(${URL_TOKEN})\s*\}\}`, // {{pdf: url}}
    String.raw`!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]`, // ![[token]] or ![[token|alt]]
    String.raw`\[\[([^\]|]+)(?:\|[^\]]*)?\]\]`, // [[token]] or [[token|label]]
    `(${URL_TOKEN})`, // a bare URL, rewritten only when a row matches it
  ].join("|"),
  "g",
);

/**
 * Sentence punctuation that ends a bare URL rather than belonging to it. The same
 * expression as `findAssetReferences.TRAILING_PUNCTUATION`, and it has to stay the same:
 * the publisher strips it before recording `filepath`, so a lookup that did not strip it
 * would miss every asset a note mentioned at the end of a sentence.
 */
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

/**
 * The forms of a token that could match a recorded reference, in decreasing fidelity.
 *
 * Two mismatches are known and neither is the publisher's to fix. Trailing punctuation is
 * stripped at publication but is inside the token here. And a markdown link percent-
 * encodes what a vault path spells plainly — Obsidian records `my folder/d.png` from
 * `metadataCache`, while the note itself holds `my%20folder/d.png` — so any vault path
 * with a space in it needs the decoded form to match.
 */
export const lookupCandidates = (ref: string): string[] => {
  const candidates = [ref];
  const withoutPunctuation = ref.replace(TRAILING_PUNCTUATION, "");
  if (withoutPunctuation !== ref) candidates.push(withoutPunctuation);
  for (const candidate of [...candidates]) {
    try {
      const decoded = decodeURIComponent(candidate);
      if (decoded !== candidate) candidates.push(decoded);
    } catch {
      // A stray `%` is not an encoding, and the raw form is already a candidate.
    }
  }
  return candidates;
};

/**
 * What one match of `LINK_PATTERN` refers to, read from the capture groups in the order
 * the pattern lists its branches.
 *
 * Shared with `collectAssetTokens` so that the tokens a caller can see are exactly the
 * tokens this file will rewrite. Anything deriving that set independently drifts from it,
 * and a token missing from the caller's set is an asset silently dropped.
 */
const parseMatch = (
  groups: (string | undefined)[],
):
  | {
      ref: string;
      form: ReferenceForm;
      declaredKind?: AssetKind;
      linkText: string;
    }
  | undefined => {
  const [
    imageAlt,
    imageRef,
    linkLabel,
    linkRef,
    bracketedMediaKind,
    bracketedMediaRef,
    mediaKind,
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
  if (ref === undefined) return undefined;

  const form: ReferenceForm =
    imageRef !== undefined ||
    bracketedMediaRef !== undefined ||
    mediaRef !== undefined ||
    embedRef !== undefined
      ? "embed"
      : bareRef !== undefined
        ? "bare"
        : "link";

  return {
    ref,
    form,
    declaredKind: (bracketedMediaKind ?? mediaKind) as AssetKind | undefined,
    // A wikilink embed carries no separate text, so its label comes from the asset.
    linkText: imageRef ? (imageAlt ?? "") : (linkLabel ?? ""),
  };
};

/**
 * Every token this markdown refers an asset by, as `rewriteAssetLinks` will read them.
 *
 * A caller deciding which recorded references are worth acting on has to ask the text the
 * same question the rewrite will ask it. Widening each of these through
 * `lookupCandidates` yields exactly the set of `sourceRef` values that would resolve, so
 * a caller's set and the rewriter's are equal by construction rather than by agreement.
 */
export const collectAssetTokens = (markdown: string): string[] => {
  const tokens: string[] = [];
  for (const match of markdown.matchAll(LINK_PATTERN)) {
    const [, ...groups] = match;
    const parsed = parseMatch(groups);
    if (parsed) tokens.push(parsed.ref);
  }
  return tokens;
};

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
      const parsed = parseMatch(groups);
      if (!parsed) return match;
      const { ref, form, declaredKind, linkText } = parsed;

      const candidates = lookupCandidates(ref);
      const matched = candidates.find((candidate) => byRef.has(candidate));
      if (matched === undefined) return match;
      const asset = byRef.get(matched);
      if (!asset) return match;

      const rewritten = render({
        asset,
        linkText,
        context: { form, declaredKind },
      });

      // Punctuation only comes back on a bare URL, where it was the sentence's rather
      // than the link's. Inside `![](…)` or `{{[[pdf]]: …}}` the token is delimited
      // already, so a trailing character there was part of the URL the publisher chose
      // to record without — putting it back would leave a stray mark beside the embed.
      const trailing =
        form === "bare" && matched !== ref
          ? (ref.match(TRAILING_PUNCTUATION)?.[0] ?? "")
          : "";
      return `${rewritten}${trailing}`;
    },
  );
};
