// Shared by the CM6 extensions that scan raw markdown for internal links.

/** Embeds are not matched: the leading `!` sits outside, so callers check it. */
export const INTERNAL_LINK_RE =
  /\[\[([^\]]+)\]\]|\[([^\]]+)\]\(([^)]+\.md(?:#[^)]*)?)\)/g;

/** Target of a wikilink or markdown link; any `#subpath` is left for parseLinktext. */
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
