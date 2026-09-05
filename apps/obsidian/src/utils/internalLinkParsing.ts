/**
 * Pure parsing for internal links in raw markdown, kept free of Obsidian and
 * CodeMirror imports so it stays directly testable.
 */

/**
 * Wikilinks `[[...]]` and markdown links `[text](path.md)`.
 *
 * Embeds are not excluded here: the leading `!` sits outside the match, so the
 * caller has to check the preceding character.
 */
export const INTERNAL_LINK_RE = /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+\.md)\)/g;

/**
 * Extracts the link target from a wikilink or markdown link match.
 *
 * Any `#heading` subpath is left in place; resolving it is the caller's job,
 * since Obsidian's own parseLinktext handles that.
 */
export const extractLinktext = (match: string): string => {
  if (match.startsWith("[[")) {
    const inner = match.slice(2, -2);
    const pipeIndex = inner.indexOf("|");
    return pipeIndex >= 0 ? inner.slice(0, pipeIndex) : inner;
  }

  const parenOpen = match.lastIndexOf("(");
  const rawPath = match.slice(parenOpen + 1, -1);
  try {
    return decodeURIComponent(rawPath);
  } catch {
    return rawPath;
  }
};
