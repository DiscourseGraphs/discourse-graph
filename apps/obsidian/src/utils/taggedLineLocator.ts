import type {
  CacheItem,
  CachedMetadata,
  ListItemCache,
  Loc,
  SectionCache,
} from "obsidian";
import { extractListPrefix } from "~/utils/taggedLine";

type TaggedLineTarget = {
  blockIndex: number;
  blockCount: number;
  item?: { kind: "li" | "tr"; index: number; count: number };
};

// Footnote definitions render in a trailing footnotes section; empty EOF sections render nothing.
const rendersInPlace = ({ type, position }: SectionCache): boolean =>
  type !== "footnoteDefinition" &&
  position.start.offset !== position.end.offset;

/**
 * Maps a 0-based source line to the `MarkdownRenderer.render` output, which
 * has no source-line mapping but emits one top-level element per section.
 */
export const locateTaggedLine = ({
  sections,
  listItems = [],
  line,
}: {
  sections: SectionCache[];
  listItems?: ListItemCache[];
  line: number;
}): TaggedLineTarget | null => {
  const blocks = sections.filter(rendersInPlace);
  const covers = ({ position }: CacheItem): boolean =>
    position.start.line <= line && line <= position.end.line;
  const blockIndex = blocks.findIndex(covers);
  const block = blocks[blockIndex];
  if (!block) return null;

  const target = { blockIndex, blockCount: blocks.length };
  const { start, end } = block.position;
  if (block.type === "list") {
    const items = listItems
      .filter(
        ({ position }) =>
          start.line <= position.start.line && position.start.line <= end.line,
      )
      .sort((a, b) => a.position.start.line - b.position.start.line);
    // Nested items start later, so the last covering item is the innermost.
    const index = items.map(covers).lastIndexOf(true);
    return index === -1
      ? target
      : { ...target, item: { kind: "li", index, count: items.length } };
  }
  if (block.type === "table") {
    const row = line - start.line;
    // The separator line (row 1) renders no <tr>.
    if (row === 1) return target;
    return {
      ...target,
      item: {
        kind: "tr",
        index: row === 0 ? 0 : row - 1,
        count: end.line - start.line,
      },
    };
  }
  return target;
};

const QUOTE_MARKERS_REGEX = /^\s*(?:>\s*)+/;
const HEADING_MARKER_REGEX = /^#{1,6}\s+/;
const TABLE_ROW_REGEX = /^\s*\|/;

const stripInlineMarkdown = (text: string): string =>
  text
    .replace(/!\[\[[^\]]*\]\]|!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\[[^\]|]*\|([^\]]*)\]\]/g, "$1")
    .replace(/\[\[([^\]]*)\]\]/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[\^[^\]]+\]|%%.*?%%/g, "")
    .replace(/(\*\*|__|==|~~)(.+?)\1/g, "$2")
    .replace(/\*(\S(?:.*?\S)?)\*/g, "$1")
    // An intraword underscore (snake_case) is not emphasis.
    .replace(/(^|\W)_(\S(?:.*?\S)?)_(?!\w)/g, "$1$2");

const lineDisplayText = (line: string): string => {
  const unquoted = line.replace(QUOTE_MARKERS_REGEX, "");
  return unquoted
    .slice(extractListPrefix(unquoted).length)
    .replace(HEADING_MARKER_REGEX, "")
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part.slice(1, -1) : stripInlineMarkdown(part)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * The text Obsidian's renderer shows for one source line, minus footnote refs,
 * embeds and comments. Tags keep their `#`; a table row becomes its cells joined by spaces.
 */
export const renderedLineText = (sourceLine: string): string =>
  TABLE_ROW_REGEX.test(sourceLine)
    ? sourceLine
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map(lineDisplayText)
        .filter(Boolean)
        .join(" ")
    : lineDisplayText(sourceLine);

/** A cache that lags an edit has section offsets that no longer line up with the text. */
export const sectionsMatchText = ({
  sections,
  text,
}: {
  sections: SectionCache[];
  text: string;
}): boolean => {
  const lineStarts = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\n") lineStarts.push(i + 1);
  }
  const isAt = ({ line, col, offset }: Loc): boolean =>
    lineStarts[line] !== undefined && lineStarts[line] + col === offset;
  return sections
    .filter(rendersInPlace)
    .every(({ position }) => isAt(position.start) && isAt(position.end));
};

// Nested lists belong to other items, and footnote refs render as "[n]".
const ownText = (el: Element): string => {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("ul, ol, sup.footnote-ref").forEach((n) => n.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
};

// A table row's cells are separate elements, so join them as `renderedLineText` does.
const displayedText = (el: HTMLElement): string =>
  el.tagName === "TR"
    ? Array.from(el.querySelectorAll("th, td"))
        .map(ownText)
        .filter(Boolean)
        .join(" ")
    : ownText(el);

const findByText = (
  container: HTMLElement,
  sourceLine: string,
): HTMLElement | null => {
  const lineText = renderedLineText(sourceLine);
  if (!lineText) return null;
  const elements = Array.from(
    container.querySelectorAll<HTMLElement>(
      "p, li, h1, h2, h3, h4, h5, h6, tr",
    ),
  ).map((el) => ({ el, text: displayedText(el) }));

  // Only a unique match is safe; containment covers one line of a multi-line paragraph.
  const exact = elements.filter(({ text }) => text === lineText);
  if (exact.length) return exact.length === 1 ? (exact[0]?.el ?? null) : null;
  const containing = elements.filter(({ text }) => text.includes(lineText));
  return containing.length === 1 ? (containing[0]?.el ?? null) : null;
};

export const findTaggedLineElement = ({
  container,
  cache,
  text,
  line,
}: {
  container: HTMLElement;
  cache: CachedMetadata | null;
  text: string;
  line: number;
}): HTMLElement | null => {
  const sections = cache?.sections;
  const target =
    sections && sectionsMatchText({ sections, text })
      ? locateTaggedLine({ sections, listItems: cache.listItems, line })
      : null;
  const blocks = container.querySelectorAll<HTMLElement>(
    ":scope > :not(section.footnotes)",
  );
  if (target && blocks.length === target.blockCount) {
    const block = blocks[target.blockIndex];
    const { item } = target;
    if (!item) return block ?? null;
    const items = block?.querySelectorAll<HTMLElement>(item.kind);
    if (items?.length === item.count) return items[item.index] ?? null;
  }
  // A stale cache or an unexpected render: fall back to the line's text.
  return findByText(container, text.split("\n")[line] ?? "");
};
