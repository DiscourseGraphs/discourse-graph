/**
 * Rewrites the asset links in an imported node's markdown to point at this graph's own
 * copies.
 *
 * A locator is rewritten when a `FileReference` row matches it and left alone when none
 * does, whatever its shape, so an external link stays untouched. An asset that has a row
 * but could not be copied is marked instead, so the reader knows to refresh the page.
 */

import mimeDb from "mime-db";
import { TRAILING_PUNCTUATION } from "./findAssetReferences";

/** How Roam has to be told to render an asset, which is not the same for every type. */
type AssetKind = "image" | "pdf" | "audio" | "video" | "file";

export const FAILED_IMPORT_MARKER = "Failed to import";
export const TOO_LARGE_MARKER = "Too large for import";

export type AssetImportMarker =
  | typeof FAILED_IMPORT_MARKER
  | typeof TOO_LARGE_MARKER;

/** An asset with a recorded row that this graph holds no copy of. */
export type UnresolvedAsset = {
  /** The locator as the published markdown holds it, from `FileReference.filepath`. */
  sourceLocator: string;
  marker: AssetImportMarker;
};

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
 * Roam's own rule, verified against `file.upload`: it branches on the first part of the
 * type, and everything it does not recognise becomes a bare URL. Reproduced rather than
 * curated, so an imported asset renders like the same file uploaded directly, awkward
 * cases included (`image/vnd.adobe.photoshop` embeds, possibly as a broken image).
 *
 * Normalised first: the value comes from a `FileReference` row, so its case and
 * parameters are not ours to assume.
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
 * Several types can claim one extension (`.mp4` is both `application/mp4` and
 * `video/mp4`) and `mime-db` states no preference. A non-rendering type never wins; where
 * two rendering types claim an extension the first indexed wins, costing the wrong player
 * rather than a broken link.
 *
 * Prototype-free and read through `Object.hasOwn`: a locator ending in `.constructor`
 * would otherwise resolve to a function and write `undefined` into the user's page.
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
 * recorded MIME type, the kind the markdown named, the extension on either name, then the
 * form it was written in. An unrecognised type is a `file`, the one form that works for
 * anything.
 */
const kindOf = (
  { sourcePath, sourceLocator, mimetype }: ResolvedAsset,
  { form, declaredKind }: ReferenceContext,
): AssetKind => {
  const byType = kindForMimetype(mimetype);
  if (byType) return byType;

  if (declaredKind) return declaredKind;

  const named =
    kindForExtension(extensionOf(sourcePath ?? "")) ??
    kindForExtension(extensionOf(sourceLocator));
  if (named) return named;

  // Only where nothing names an extension: an embed of `report.docx` said "embed", never
  // "image", so treating it as one would drop the filename `labelFor` exists to show.
  const unnamed = !extensionOf(sourcePath ?? "") && !extensionOf(sourceLocator);
  return form === "embed" && unnamed ? "image" : "file";
};

/**
 * Brackets end a markdown label early, and `Paper [draft].pdf` is an ordinary attachment
 * name. Stripping is the only option: Roam honours no escape, and `\[` was verified in a
 * graph to break exactly as a bare `[` does.
 *
 * Applied only to a label we invent or translate, never to image alt text, which is the
 * author's own markdown and renders as it always did.
 */
const stripLabelBrackets = (label: string): string =>
  label.replace(/[[\]]/g, "");

/**
 * The label for an asset Roam renders as a link rather than as content. Without it the
 * visible text is the storage URL, so this is the only place a reader learns what an
 * imported file is called. A row that records no name has nothing better than the uid
 * leaf to fall back to.
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
  // No Roam media embed carries text, so embedding a link that has some would delete the
  // only words the reader sees. Kind is irrelevant: this is about text to lose.
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
      // The pipe is spent only here. On an image, audio or video it was a width, and the
      // branches above drop it rather than print `![300](…)`.
      return `[${stripLabelBrackets(
        labelFor({ asset, linkText: linkText || context.embedAlias || "" }),
      )}](${asset.url})`;
  }
};

const isUrlLocator = (locator: string): boolean =>
  /^https?:\/\//i.test(locator);

/** `encodeURI` leaves these alone, but each would change or end a link destination. */
const encodeDestination = (path: string): string =>
  encodeURI(path).replace(
    /[#?()]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase().padStart(2, "0")}`,
  );

/**
 * Link label text up to a bracket. A whole image counts as text, so several images can
 * share one label: `[![a](x)![b](y)](link)`.
 */
const LABEL_TEXT = String.raw`(?:[^[\]\n]|!\[[^\]\n]*\]\([^)\n]*\))*`;
const LABEL_BEFORE = new RegExp(String.raw`\[${LABEL_TEXT}$`);
const LABEL_AFTER = new RegExp(String.raw`^${LABEL_TEXT}\]\(`);

/**
 * Whether the text from `start` to `end` sits in the label of a markdown link on its
 * line, as the image in `[see ![alt](image)](link)` does.
 */
const isInsideLinkLabel = ({
  markdown,
  start,
  end,
}: {
  markdown: string;
  start: number;
  end: number;
}): boolean => {
  const lineStart = markdown.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = markdown.indexOf("\n", end);
  return (
    LABEL_BEFORE.test(markdown.slice(lineStart, start)) &&
    LABEL_AFTER.test(
      markdown.slice(end, lineEnd === -1 ? markdown.length : lineEnd),
    )
  );
};

/** `![[x.png|300]]` and `![[x.png|300x200]]` size an embed rather than name it. */
const EMBED_SIZE = /^\d+(x\d+)?$/;

/**
 * A URL locator keeps its link or embed, since the origin copy may still render, and the
 * marker follows it. A vault path renders as nothing in Roam, so it becomes a link whose
 * label carries the marker next to the label the source wrote.
 */
const renderMarked = ({
  marker,
  match,
  locator,
  isEncoded,
  isInsideLinkLabel,
  linkText,
  embedAlias,
}: {
  marker: AssetImportMarker;
  match: string;
  locator: string;
  isEncoded: boolean;
  isInsideLinkLabel: boolean;
  linkText: string;
  embedAlias?: string;
}): string => {
  if (isUrlLocator(locator)) return `${match} (${marker})`;

  const alias = embedAlias && !EMBED_SIZE.test(embedAlias) ? embedAlias : "";
  const label = stripLabelBrackets((linkText || alias).trim());
  const text = label ? `${label} (${marker})` : marker;
  // A link inside the label of `[![alt](image)](link)` would break both links.
  if (isInsideLinkLabel) return text;
  return `[${text}](${isEncoded ? locator : encodeDestination(locator)})`;
};

/** A URL as it sits in content, stopping at the punctuation that encloses it. */
const URL_PATTERN = String.raw`https?://[^\s<>()\[\]{}"']+`;

/**
 * The link forms an imported node's markdown can express an asset in, matched in one pass
 * so that a locator inside an embed is never also treated as a bare reference.
 *
 * Ordered. The media-embed branches precede the wikilink ones, or `{{[[pdf]]: url}}`, the
 * form Roam writes a stored PDF in, would be read as a page reference to `pdf`.
 *
 * The wikilink branches match Roam page references too, but those never resolve: a page
 * name is not a recorded locator.
 *
 * Every branch stops at a line break. Roam stores a page as blocks, so a reference spelled
 * across one could be rewritten here but never again from a single block's text, and the
 * two readings would disagree. One spelled that way is left as published instead, which is
 * what an asset with no row already gets.
 */
const LINK_PATTERN = new RegExp(
  [
    String.raw`!\[([^\]\n]*)\]\((<[^>\n]*>|[^)\s]+)(?:[^\S\n]+"[^"\n]*")?\)`, // ![alt](locator)
    // No `[` in the label, so the outer bracket of `[![alt](image)](link)` fails here and
    // the scan reaches the inner embed. Alternation is per position, so branch order
    // alone would not do it.
    String.raw`\[([^\]\[\n]*)\]\((<[^>\n]*>|[^)\s]+)(?:[^\S\n]+"[^"\n]*")?\)`, // [label](locator)
    // The keyword is captured, not discarded: for a storage uid with no extension it is
    // the only statement of the type.
    String.raw`\{\{\[\[(pdf|audio|video)\]\]:[^\S\n]*(${URL_PATTERN})[^\S\n]*\}\}`, // {{[[pdf]]: url}}
    String.raw`\{\{(pdf|audio|video):[^\S\n]*(${URL_PATTERN})[^\S\n]*\}\}`, // {{pdf: url}}
    // The pipe is a width on an image (`![[x.png|300]]`) and a label on anything else
    // (`![[a.pdf|the paper]]`), so it is captured and `render` decides once it has a kind.
    String.raw`!\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]`, // ![[locator]] or ![[locator|300]]
    String.raw`\[\[([^\]|\n]+)(?:\|([^\]\n]*))?\]\]`, // [[locator]] or [[locator|label]]
    // An autolink is matched whole so its brackets go away with the rest of the match.
    // Capturing only the URL would leave `<` and `>` around the rewritten link.
    `(<${URL_PATTERN}>|${URL_PATTERN})`, // a bare URL, rewritten only when a row matches it
  ].join("|"),
  "g",
);

/**
 * The forms of a locator that could match a recorded reference, in decreasing fidelity.
 * Two known mismatches: publication strips trailing punctuation that is inside the locator
 * here, and a markdown link percent-encodes what a vault path spells plainly (Obsidian
 * records `my folder/d.png` while the note holds `my%20folder/d.png`).
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
 * the pattern lists its branches. Shared with `collectAssetLocators` so a caller sees
 * exactly the locators this file will rewrite.
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
      /** Spelled as a markdown destination, so already percent-encoded. */
      isEncoded: boolean;
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
    isEncoded:
      (imageLocator ?? linkLocator) !== undefined && locator === bracketed,
    // A wikilink embed carries no separate text, so its label comes from the asset.
    linkText: imageLocator ? (imageAlt ?? "") : (linkLabel ?? wikiLabel ?? ""),
  };
};

/**
 * Every locator this markdown refers an asset by, as `rewriteAssetLinks` reads them.
 * Widening these through `lookupCandidates` gives exactly the locators that would resolve,
 * so a caller deciding which references to act on cannot drift from the rewrite.
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
  unresolved = [],
}: {
  markdown: string;
  assets: ResolvedAsset[];
  unresolved?: UnresolvedAsset[];
}): string => {
  if (!assets.length && !unresolved.length) return markdown;
  const byLocator = new Map(
    assets.map((asset) => [asset.sourceLocator, asset]),
  );
  const unresolvedByLocator = new Map(
    unresolved.map((asset) => [asset.sourceLocator, asset]),
  );

  return markdown.replace(LINK_PATTERN, (match: string, ...args: unknown[]) => {
    const parsed = parseMatch(args as (string | undefined)[]);
    if (!parsed) return match;
    const { locator, form, declaredKind, embedAlias, linkText, isEncoded } =
      parsed;

    const context = { form, declaredKind, embedAlias };
    const candidates = lookupCandidates(locator);
    // A copy wins over a marker when two spellings match different rows.
    const matched =
      candidates.find((candidate) => byLocator.has(candidate)) ??
      candidates.find((candidate) => unresolvedByLocator.has(candidate));
    if (matched === undefined) return match;

    // Punctuation comes back only on a bare URL, where it was the sentence's. Inside
    // `![](…)` the locator is already delimited, so a trailing character belonged to
    // the URL and restoring it would leave a stray mark beside the embed.
    const trailing =
      form === "bare" && matched !== locator
        ? (locator.match(TRAILING_PUNCTUATION)?.[0] ?? "")
        : "";

    const asset = byLocator.get(matched);
    if (asset) return `${render({ asset, linkText, context })}${trailing}`;

    const unresolvedAsset = unresolvedByLocator.get(matched);
    if (!unresolvedAsset) return match;
    // A marked URL keeps its own text, so the sentence's punctuation is split off it
    // first. In an autolink it sits inside the brackets and stays there.
    const [reference, after] =
      trailing && match.endsWith(trailing)
        ? [match.slice(0, -trailing.length), trailing]
        : [match, ""];
    // The match offset is the only number `replace` passes.
    const offset = args.find((arg) => typeof arg === "number") as number;
    return `${renderMarked({
      marker: unresolvedAsset.marker,
      match: reference,
      // As spelled, not as recorded: the recorded form is decoded.
      locator,
      isEncoded,
      isInsideLinkLabel:
        match.startsWith("![") &&
        isInsideLinkLabel({
          markdown,
          start: offset,
          end: offset + match.length,
        }),
      linkText,
      embedAlias,
    })}${after}`;
  });
};
