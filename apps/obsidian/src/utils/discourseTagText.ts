// Kept free of Obsidian and CodeMirror imports so `node:test` can import it.

const LIST_INDICATOR_REGEX = /^(\s*)(\d+[.)]\s+|[-*+]\s+(?:\[[ xX]\]\s+)?)/;

const TAG_SEGMENT_PREFIX = "tag-";

const sanitizeTitle = (title: string): string =>
  title
    .replace(LIST_INDICATOR_REGEX, "")
    .replace(/[\\/:]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const extractListPrefix = (line: string): string =>
  line.match(LIST_INDICATOR_REGEX)?.[0] ?? "";

export const titleFromTaggedLine = (lineText: string): string =>
  sanitizeTitle(lineText.replace(/#[^\s]+/g, ""));

/**
 * Obsidian names hashtag syntax nodes like `hashtag_hashtag-end_meta_tag-clm-candidate`.
 * Reading the tag from there inherits its rules for code blocks, URLs and headings.
 */
export const tagNameFromSyntaxNode = (nodeName: string): string | null => {
  if (!nodeName.includes("hashtag")) return null;
  const segment = nodeName
    .split("_")
    .find(
      (part) =>
        part.startsWith(TAG_SEGMENT_PREFIX) &&
        part.length > TAG_SEGMENT_PREFIX.length,
    );
  return segment ? segment.slice(TAG_SEGMENT_PREFIX.length) : null;
};

export type TaggedRange<TStyle extends { nodeTypeId: string }> = {
  from: number;
  to: number;
  style: TStyle;
};

/** The `#` and the tag name are separate syntax nodes; join them into one chip. */
export const mergeAdjacentRanges = <TStyle extends { nodeTypeId: string }>(
  ranges: TaggedRange<TStyle>[],
): TaggedRange<TStyle>[] => {
  const sorted = [...ranges].sort((a, b) => a.from - b.from);
  const merged: TaggedRange<TStyle>[] = [];

  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (
      previous &&
      previous.to === range.from &&
      previous.style.nodeTypeId === range.style.nodeTypeId
    ) {
      previous.to = range.to;
      continue;
    }
    merged.push({ ...range });
  }

  return merged;
};
