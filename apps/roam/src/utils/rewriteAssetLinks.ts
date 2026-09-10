/**
 * Rewrites the asset links in an imported node's markdown to point at this graph's own
 * copies.
 *
 * Resolution is by recorded row, never by origin. Each `FileReference` records the locator
 * exactly as the publishing platform's content expressed it, so a locator is rewritten when
 * a row matches it and left alone when none does. That one rule covers every case: a
 * genuinely external link has no row, and so does an asset whose bytes could not be
 * copied, which is why leaving the locator untouched is also the degradation path. Nothing
 * here inspects a locator's shape: a Roam-origin locator is a storage URL and an
 * Obsidian-origin one is a vault path, and this code never needs to know which it has.
 */

import mimeDb from "mime-db";
import { TRAILING_PUNCTUATION } from "./findAssetReferences";

/** How Roam has to be told to render an asset, which is not the same for every type. */
type AssetKind = "image" | "pdf" | "audio" | "video" | "file";

export type ResolvedAsset = {
  /** The locator as the published markdown holds it, from `FileReference.filepath`. */
  sourceLocator: string;
  /** Where this graph's own copy lives. */
  url: string;
  /** The name the reference records, from `FileReference.source_path`. */
  sourcePath?: string | null;
  mimetype?: string;
};

/**
 * The kind Roam renders a MIME type as.
 *
 * Roam's own rule, verified by uploading one file per type and reading back what
 * `file.upload` returned: it branches on the first part of the type. Every `image/*`
 * embeds, `audio/*` and `video/*` get their players, `application/pdf` gets the PDF
 * viewer, and everything else is written as a bare URL.
 *
 * Reproduced rather than curated, so an imported asset renders the way the same file
 * would if it had been uploaded into this graph directly. That includes the awkward
 * cases: `image/vnd.adobe.photoshop` embeds and may show a broken image, exactly as it
 * does for a native upload.
 *
 * Normalised first: the value comes from a `FileReference` row, not from `mime-db`, so
 * its case and parameters are not ours to assume.
 */
const kindForMimetype = (
  mimetype: string | undefined,
): AssetKind | undefined => {
  const [type, subtype] =
    mimetype?.toLowerCase().split(";")[0]?.trim().split("/") ?? [];
  if (type === "image") return "image";
  if (type === "audio") return "audio";
  if (type === "video") return "video";
  // Scoped to the one type verified above.
  if (type === "application" && subtype === "pdf") return "pdf";
  return undefined;
};

/**
 * Extension to kind, indexed from `mime-db` rather than maintained here.
 *
 * An extension can be claimed by several types, and `mime-db` states no preference:
 * `.mp4` is both `application/mp4` and `video/mp4`. A type that renders as nothing never
 * wins, which settles every case that matters. Where two rendering types claim one
 * extension the first indexed wins, and since both embed, the cost is the wrong player
 * rather than a broken link.
 *
 * Prototype-free, and read through `Object.hasOwn`: a locator ending in `.constructor`
 * would otherwise look up a function, fail every `case` in `render`, and write the
 * literal string `undefined` into the user's page in place of their content.
 */
const EXTENSION_KINDS: Record<string, AssetKind> = Object.entries(
  mimeDb,
).reduce(
  (map, [mimetype, definition]) => {
    const kind = kindForMimetype(mimetype);
    if (kind === undefined) return map;
    for (const extension of definition.extensions ?? [])
      if (map[extension] === undefined) map[extension] = kind;
    return map;
  },
  Object.create(null) as Record<string, AssetKind>,
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
 * How the source markdown wrote the reference: `embed` is `![...]` in any of its
 * spellings, `link` is `[...]`, and a bare URL is neither.
 */
type ReferenceForm = "embed" | "link" | "bare";

/** How the reference was written, and what the source said it was, where it said so. */
type ReferenceContext = {
  form: ReferenceForm;
  /** From `{{[[pdf]]: url}}` and its bracket-less spelling, which name the type. */
  declaredKind?: AssetKind;
  /**
   * What followed the pipe in `![[locator|…]]`. A width on an image and a label on
   * anything else, so only `render` can spend it, once the kind is known.
   */
  embedAlias?: string;
};

/**
 * What kind of asset this is, in decreasing order of how much the source committed to:
 * the recorded MIME type, the kind the markdown named outright, the extension on either
 * name, and finally the form it was written in. An unrecognised type is a `file`, which
 * renders as a labelled link and is the one form that works for anything.
 *
 * The form ranks last as the weakest evidence, deciding only where nothing else can: an
 * extension-less locator embedded as `![](url)`. Roam keeps the extension after the uid on
 * nearly every upload, so that is rare, and with nothing populating `mimetype` the
 * extension does the work in practice.
 */
const kindOf = (
  { sourcePath, sourceLocator, mimetype }: ResolvedAsset,
  { form, declaredKind }: ReferenceContext,
): AssetKind => {
  const byType = kindForMimetype(mimetype);
  if (byType) return byType;

  // `{{[[pdf]]: url}}` is not a guess to be improved on: the source said what this is.
  if (declaredKind) return declaredKind;

  const named =
    kindForExtension(extensionOf(sourcePath ?? "")) ??
    kindForExtension(extensionOf(sourceLocator));
  if (named) return named;

  // Only where nothing names an extension. An embed of `report.docx` said "embed" but
  // never said "image", and treating it as one would assert a type the source contradicts
  // and drop the filename `labelFor` exists to show. An extension-less locator has no such
  // claim to contradict, and there `![...]` is the only evidence available.
  const unnamed = !extensionOf(sourcePath ?? "") && !extensionOf(sourceLocator);
  return form === "embed" && unnamed ? "image" : "file";
};

/**
 * Brackets end a markdown label early, and `Paper [draft].pdf` is an ordinary attachment
 * name. Stripping is not a fallback for escaping, it is the only option: Roam honours no
 * escape, and `\[` was verified in a graph to break exactly as a bare `[` does.
 *
 * Applied only where a bracket would newly break something: a label we invent from a
 * filename, and a wikilink alias we translate into markdown link syntax. Image alt text
 * is passed through untouched, because it is the author's own markdown and renders the
 * way it always did.
 */
const stripLabelBrackets = (label: string): string =>
  label.replace(/[[\]]/g, "");

/**
 * The label for an asset Roam renders as a link rather than as content.
 *
 * `file.upload` returns a bare URL for anything that is not an image, PDF, audio or
 * video, and a bare URL in a block renders as a link whose visible text is the URL: a
 * hundred characters of storage uid telling the reader nothing. This label is the only
 * place a user sees what an imported file is called.
 *
 * One case has nothing better to offer: a bare storage URL whose row records no name,
 * where the label falls back to the uid leaf, shorter than the URL and no more
 * informative. Only a recorded name fixes that; the type ranks decide how an asset
 * renders, not what it is called.
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
  // `||`, not `??`: an empty recorded name is no name, and falling through to the locator
  // is what the chain is for. With `??` the label would come out as the storage URL,
  // which is exactly what this function exists to avoid.
  const leaf = (asset.sourcePath || asset.sourceLocator).split(/[?#]/)[0] ?? "";
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
  // A note that wrote `[Figure 3](image)` chose a link over an embed, and no Roam media
  // embed carries text, so embedding any of them would delete the only words the reader
  // sees. Kind is irrelevant here: an embed, a bare URL, and a link with nothing in its
  // brackets all have no text to lose, and every other link does.
  if (context.form === "link" && linkText.trim())
    return `[${stripLabelBrackets(linkText.trim())}](${asset.url})`;

  switch (kindOf(asset, context)) {
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
      // Only here. On an image, audio or video the pipe was a width, and the branches
      // above ignore it rather than printing `![300](…)`.
      return `[${stripLabelBrackets(
        labelFor({ asset, linkText: linkText || context.embedAlias || "" }),
      )}](${asset.url})`;
  }
};

/** A URL as it sits in content, stopping at the punctuation that encloses it. */
const URL_PATTERN = String.raw`https?://[^\s<>()\[\]{}"']+`;

/**
 * The link forms an imported node's markdown can express an asset in, matched in one pass
 * so that a locator inside an embed is never also treated as a bare reference.
 *
 * Ordered. The media-embed branches precede the wikilink ones, or `{{[[pdf]]: url}}`
 * would be read as a page reference to `pdf` and its URL left behind as a bare locator.
 * Roam writes a stored PDF in exactly that form, so this is the shape a Roam-origin
 * asset arrives in, not a hypothetical one.
 *
 * The wikilink branches carry Obsidian-origin notes. A Roam page reference is written the
 * same way, so it is matched too, but it can never resolve: a page name is not a recorded
 * locator, and an unmatched locator is left exactly as it was.
 */
const LINK_PATTERN = new RegExp(
  [
    String.raw`!\[([^\]]*)\]\((<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\)`, // ![alt](locator)
    // No `[` in the label, so `[![alt](image)](link)` cannot match here from the outer
    // bracket: the branch fails, the scan advances one character, and the image branch
    // takes the inner embed as it should. Alternation is tried per position, so ordering
    // the image branch first is not enough on its own.
    String.raw`\[([^\]\[]*)\]\((<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\)`, // [label](locator)
    // The media keyword is captured, not discarded: it is the source stating the type,
    // and it is the only statement available for a storage uid with no extension.
    String.raw`\{\{\[\[(pdf|audio|video)\]\]:\s*(${URL_PATTERN})\s*\}\}`, // {{[[pdf]]: url}}
    String.raw`\{\{(pdf|audio|video):\s*(${URL_PATTERN})\s*\}\}`, // {{pdf: url}}
    // The embed's pipe means two things depending on what it embeds: a width for an
    // image (`![[x.png|300]]`) and a label for anything else (`![[a.pdf|the paper]]`).
    // It is captured either way and `render` decides, because only the resolved kind
    // says which one this is.
    String.raw`!\[\[([^\]|]+)(?:\|([^\]]*))?\]\]`, // ![[locator]] or ![[locator|300]]
    String.raw`\[\[([^\]|]+)(?:\|([^\]]*))?\]\]`, // [[locator]] or [[locator|label]]
    // The bracketed form is an autolink. Matching it whole, brackets included, is what
    // lets them go away with the rest of the match: capturing only the URL inside would
    // rewrite the middle and leave `<` and `>` wrapped around the result.
    `(<${URL_PATTERN}>|${URL_PATTERN})`, // a bare URL, rewritten only when a row matches it
  ].join("|"),
  "g",
);

/**
 * The forms of a locator that could match a recorded reference, in decreasing fidelity.
 *
 * Two mismatches are known and neither is the publisher's to fix. Trailing punctuation is
 * stripped at publication but is inside the locator here. And a markdown link percent-
 * encodes what a vault path spells plainly. Obsidian records `my folder/d.png` from
 * `metadataCache`, while the note itself holds `my%20folder/d.png`, so any vault path
 * with a space in it needs the decoded form to match.
 */
export const lookupCandidates = (locator: string): string[] => {
  const candidates = [locator];
  const withoutPunctuation = locator.replace(TRAILING_PUNCTUATION, "");
  if (withoutPunctuation !== locator) candidates.push(withoutPunctuation);
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
 * Shared with `collectAssetLocators` so that the locators a caller can see are exactly the
 * locators this file will rewrite. Anything deriving that set independently drifts from it,
 * and a locator missing from the caller's set is an asset silently dropped.
 */
const parseMatch = (
  groups: (string | undefined)[],
):
  | {
      locator: string;
      form: ReferenceForm;
      declaredKind?: AssetKind;
      embedAlias?: string;
      linkText: string;
    }
  | undefined => {
  const [
    imageAlt,
    imageLocator,
    linkLabel,
    linkLocator,
    bracketedMediaKind,
    bracketedMediaLocator,
    mediaKind,
    mediaLocator,
    embedLocator,
    embedAlias,
    wikiLocator,
    wikiLabel,
    bareLocator,
  ] = groups;
  const bracketed =
    imageLocator ??
    linkLocator ??
    bracketedMediaLocator ??
    mediaLocator ??
    embedLocator ??
    wikiLocator ??
    bareLocator;
  if (bracketed === undefined) return undefined;
  const locator =
    bracketed.startsWith("<") && bracketed.endsWith(">")
      ? bracketed.slice(1, -1)
      : bracketed;

  const form: ReferenceForm =
    imageLocator !== undefined ||
    bracketedMediaLocator !== undefined ||
    mediaLocator !== undefined ||
    embedLocator !== undefined
      ? "embed"
      : bareLocator !== undefined
        ? "bare"
        : "link";

  return {
    locator,
    form,
    declaredKind: (bracketedMediaKind ?? mediaKind) as AssetKind | undefined,
    embedAlias,
    // A wikilink embed carries no separate text, so its label comes from the asset.
    linkText: imageLocator ? (imageAlt ?? "") : (linkLabel ?? wikiLabel ?? ""),
  };
};

/**
 * Every locator this markdown refers an asset by, as `rewriteAssetLinks` will read them.
 *
 * A caller deciding which recorded references are worth acting on has to ask the text the
 * same question the rewrite will ask it. Widening each of these through
 * `lookupCandidates` yields exactly the set of `locator` values that would resolve, so
 * a caller's set and the rewriter's are equal by construction rather than by agreement.
 */
export const collectAssetLocators = (markdown: string): string[] => {
  const locators: string[] = [];
  for (const match of markdown.matchAll(LINK_PATTERN)) {
    const [, ...groups] = match;
    const parsed = parseMatch(groups);
    if (parsed) locators.push(parsed.locator);
  }
  return locators;
};

export const rewriteAssetLinks = ({
  markdown,
  assets,
}: {
  markdown: string;
  assets: ResolvedAsset[];
}): string => {
  if (!assets.length) return markdown;
  const byLocator = new Map(
    assets.map((asset) => [asset.sourceLocator, asset]),
  );

  return markdown.replace(
    LINK_PATTERN,
    (match: string, ...groups: (string | undefined)[]) => {
      const parsed = parseMatch(groups);
      if (!parsed) return match;
      const { locator, form, declaredKind, embedAlias, linkText } = parsed;

      const candidates = lookupCandidates(locator);
      const matched = candidates.find((candidate) => byLocator.has(candidate));
      if (matched === undefined) return match;
      const asset = byLocator.get(matched);
      if (!asset) return match;

      const rewritten = render({
        asset,
        linkText,
        context: { form, declaredKind, embedAlias },
      });

      // Punctuation only comes back on a bare URL, where it was the sentence's rather
      // than the link's. Inside `![](…)` or `{{[[pdf]]: …}}` the locator is delimited
      // already, so a trailing character there was part of the URL the publisher chose
      // to record without. Putting it back would leave a stray mark beside the embed.
      const trailing =
        form === "bare" && matched !== locator
          ? (locator.match(TRAILING_PUNCTUATION)?.[0] ?? "")
          : "";
      return `${rewritten}${trailing}`;
    },
  );
};
