import type { InputTextNode } from "roamjs-components/types";

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/;
const HEADING_RE = /^(#{1,6})\s+(.*\S)\s*$/;
const LIST_ITEM_RE = /^(\s*)(?:[-*+]|\d+[.)])\s+(.*)$/;

const stripFrontmatter = (markdown: string): string =>
  markdown.replace(FRONTMATTER_RE, "");

type ListFrame = { node: InputTextNode; indent: number };

/**
 * Convert a markdown document into a Roam block tree (`InputTextNode[]`) — the
 * shape `createPage`/`createBlock` consume. Used when materializing an
 * Obsidian-origin shared node's `content.full` markdown into a local Roam page.
 *
 * MVP0 mapping: leading YAML frontmatter is dropped; ATX headings (`#`..`######`)
 * become Roam heading blocks (levels clamped to Roam's 1–3); list items nest by
 * indentation; every other non-blank line becomes its own top-level block. Inline
 * markup, wikilinks, and block refs pass through verbatim for Roam to render.
 */
export const markdownToRoamBlocks = (markdown: string): InputTextNode[] => {
  const roots: InputTextNode[] = [];
  const listStack: ListFrame[] = [];

  const appendBlock = (
    node: InputTextNode,
    listIndent: number | null,
  ): void => {
    if (listIndent === null) {
      roots.push(node);
      listStack.length = 0;
      return;
    }
    while (
      listStack.length &&
      listStack[listStack.length - 1].indent >= listIndent
    ) {
      listStack.pop();
    }
    const parent = listStack[listStack.length - 1];
    if (parent) {
      (parent.node.children ??= []).push(node);
    } else {
      roots.push(node);
    }
    listStack.push({ node, indent: listIndent });
  };

  for (const rawLine of stripFrontmatter(markdown).split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (!line.trim()) continue;

    const heading = HEADING_RE.exec(line);
    if (heading) {
      appendBlock(
        { text: heading[2], heading: Math.min(heading[1].length, 3) },
        null,
      );
      continue;
    }

    const listItem = LIST_ITEM_RE.exec(line);
    if (listItem) {
      const indent = listItem[1].replace(/\t/g, "  ").length;
      appendBlock({ text: listItem[2] }, indent);
      continue;
    }

    appendBlock({ text: line.trim() }, null);
  }

  return roots;
};
