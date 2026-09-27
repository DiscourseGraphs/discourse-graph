import type {
  CacheItem,
  CachedMetadata,
  ListItemCache,
  SectionCache,
} from "obsidian";
import { extractListPrefix } from "~/utils/taggedLine";

type TaggedLineTarget = {
  blockIndex: number;
  blockCount: number;
  item?: { kind: "li" | "tr"; index: number; count: number };
};

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
  // Footnote definitions render in a trailing footnotes section; empty EOF sections render nothing.
  const blocks = sections.filter(
    ({ type, position }) =>
      type !== "footnoteDefinition" &&
      position.start.offset !== position.end.offset,
  );
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

/**
 * The text Obsidian's renderer shows for one source line, minus footnote refs,
 * embeds and comments.
 * Tags keep their `#`, as the rendered tag link does.
 */
export const renderedLineText = (sourceLine: string): string => {
  const unquoted = sourceLine.replace(QUOTE_MARKERS_REGEX, "");
  return unquoted
    .slice(extractListPrefix(unquoted).length)
    .replace(HEADING_MARKER_REGEX, "")
    .split(/(`[^`]*`)/)
    .map((part, i) => (i % 2 ? part.slice(1, -1) : stripInlineMarkdown(part)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
};

// Nested lists belong to other items, and footnote refs render as "[n]".
const ownText = (el: Element): string => {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll("ul, ol, sup.footnote-ref").forEach((n) => n.remove());
  return (clone.textContent ?? "").replace(/\s+/g, " ").trim();
};

export const findTaggedLineElement = ({
  container,
  cache,
  line,
  sourceLine,
}: {
  container: HTMLElement;
  cache: CachedMetadata | null;
  line: number;
  sourceLine: string;
}): HTMLElement | null => {
  const target = cache?.sections
    ? locateTaggedLine({
        sections: cache.sections,
        listItems: cache.listItems,
        line,
      })
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

  // Counts disagree (e.g. a stale cache): only a unique exact text match is safe.
  const text = renderedLineText(sourceLine);
  if (!text) return null;
  const matches = Array.from(
    container.querySelectorAll<HTMLElement>("p, li, h1, h2, h3, h4, h5, h6"),
  ).filter((el) => ownText(el) === text);
  return matches.length === 1 ? (matches[0] ?? null) : null;
};
