const LIST_INDICATOR_REGEX = /^(\s*)(\d+[.)]\s+|[-*+]\s+(?:\[[ xX]\]\s+)?)/;

const BLOCK_MARKER_REGEX = /^\s*(?:#{1,6}\s+|>\s*)/;

const sanitizeTitle = (title: string): string =>
  title
    .replace(LIST_INDICATOR_REGEX, "")
    .replace(/[\\/:]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export const extractListPrefix = (line: string): string =>
  line.match(LIST_INDICATOR_REGEX)?.[0] ?? "";

export const titleFromTaggedLine = (lineText: string): string =>
  sanitizeTitle(
    lineText.replace(BLOCK_MARKER_REGEX, "").replace(/#[^\s]+/g, ""),
  );
