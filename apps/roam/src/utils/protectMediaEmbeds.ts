/**
 * Protects Roam's media embeds from Roam's own markdown parser.
 *
 * `{{[[pdf]]: url}}` is not markdown, so `fromMarkdown` autolinks the URL and swallows the
 * closing `}}`. The braces come back percent-encoded in the link's destination and raw in
 * its text, so the two differ and the block is written as `{{[[pdf]]: [url}}](url%7D%7D)`.
 * Wrapping the URL in `<>` ends the autolink explicitly, so Roam writes the URL back bare.
 *
 * Only this shape needs it. A bare URL and `![](url)` already survive the round trip.
 */

/**
 * Every component that carries a bare URL in this shape, not only the ones an imported
 * asset can become: the mangling is the parser's and hits all of them.
 */
const MEDIA_KEYWORDS = "pdf|audio|video|iframe|youtube";

/** Roam accepts both spellings. */
const MEDIA_KEYWORD_PATTERN = String.raw`\[\[(?:${MEDIA_KEYWORDS})\]\]|${MEDIA_KEYWORDS}`;

/**
 * Deliberately not the class the identically named pattern in `rewriteAssetLinks.ts` uses:
 * `}}` ends the match here, so parentheses need not. They come back percent-encoded, so a
 * reader sees `a%28b%29.pdf` where the author wrote `a(b).pdf`, which beats a broken embed.
 * Square brackets stay excluded: they diverge the same way the braces do above, and
 * wrapping cannot save them.
 *
 * Excluding `<` and `>` is what makes this idempotent: a wrapped embed cannot match.
 */
const URL_PATTERN = String.raw`https?://[^\s<>\[\]{}"']+`;

/** Whitespace is captured rather than normalised, so a rewrite costs the two brackets only. */
const MEDIA_EMBED = new RegExp(
  String.raw`\{\{(${MEDIA_KEYWORD_PATTERN}):([^\S\n]*)(${URL_PATTERN})([^\S\n]*)\}\}`,
  "g",
);

/**
 * Applied to the whole markdown rather than where embeds are rendered: an import passes
 * through every embed it finds no asset row for, and those are mangled the same way.
 *
 * An embed inside a code block or code span gains a visible `<>`. Accepted: cosmetic
 * there, where mangling is not.
 */
export const protectMediaEmbeds = (markdown: string): string =>
  markdown.replace(MEDIA_EMBED, (_match: string, ...args: unknown[]) => {
    const [keyword, before, url, after] = args as string[];
    return `{{${keyword}:${before}<${url}>${after}}}`;
  });
