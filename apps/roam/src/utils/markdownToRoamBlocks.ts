import { normalizeLineEndings } from "@repo/content-model";
import type { InputTextNode } from "roamjs-components/types/native";

type BlockNode = InputTextNode & { children: InputTextNode[] };

const FRONTMATTER_DELIMITER = /^---\s*$/;
const HEADING = /^(#{1,6})\s+(.+)$/;
const LIST_ITEM = /^([ \t]*)(?:[-*+]|\d+[.)])[ \t]+(.+)$/;
const ROAM_MAX_HEADING_LEVEL = 3;

const stripFrontmatter = (lines: string[]): string[] => {
  if (lines.length === 0 || !FRONTMATTER_DELIMITER.test(lines[0])) return lines;
  const closingIndex = lines.findIndex(
    (line, index) => index > 0 && FRONTMATTER_DELIMITER.test(line),
  );
  return closingIndex === -1 ? lines : lines.slice(closingIndex + 1);
};

const indentWidth = (whitespace: string): number =>
  [...whitespace].reduce((width, char) => width + (char === "\t" ? 4 : 1), 0);

export const markdownToRoamBlocks = (markdown: string): InputTextNode[] => {
  const lines = stripFrontmatter(normalizeLineEndings(markdown).split("\n"));
  const roots: InputTextNode[] = [];
  const headingStack: { level: number; node: BlockNode }[] = [];
  let listStack: { indent: number; node: BlockNode }[] = [];
  let paragraphLines: string[] = [];

  const sectionBlocks = (): InputTextNode[] =>
    headingStack.length
      ? headingStack[headingStack.length - 1].node.children
      : roots;

  const flushParagraph = (): void => {
    if (!paragraphLines.length) return;
    sectionBlocks().push({ text: paragraphLines.join("\n"), children: [] });
    paragraphLines = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];

    if (line.startsWith("```") || line.startsWith("~~~")) {
      flushParagraph();
      listStack = [];
      const fence = line.slice(0, 3);
      const fenceLines = [line];
      while (index + 1 < lines.length && !lines[index + 1].startsWith(fence)) {
        index++;
        fenceLines.push(lines[index]);
      }
      if (index + 1 < lines.length) {
        index++;
        fenceLines.push(lines[index]);
      }
      sectionBlocks().push({ text: fenceLines.join("\n"), children: [] });
      continue;
    }

    const headingMatch = HEADING.exec(line);
    if (headingMatch) {
      flushParagraph();
      listStack = [];
      const level = headingMatch[1].length;
      while (
        headingStack.length &&
        headingStack[headingStack.length - 1].level >= level
      ) {
        headingStack.pop();
      }
      const node: BlockNode = {
        text: headingMatch[2].trimEnd(),
        heading: Math.min(level, ROAM_MAX_HEADING_LEVEL),
        children: [],
      };
      sectionBlocks().push(node);
      headingStack.push({ level, node });
      continue;
    }

    const listMatch = LIST_ITEM.exec(line);
    if (listMatch) {
      flushParagraph();
      const indent = indentWidth(listMatch[1]);
      while (
        listStack.length &&
        listStack[listStack.length - 1].indent >= indent
      ) {
        listStack.pop();
      }
      const node: BlockNode = { text: listMatch[2].trimEnd(), children: [] };
      const siblings = listStack.length
        ? listStack[listStack.length - 1].node.children
        : sectionBlocks();
      siblings.push(node);
      listStack.push({ indent, node });
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      continue;
    }

    listStack = [];
    paragraphLines.push(line.trimEnd());
  }

  flushParagraph();
  return roots;
};
