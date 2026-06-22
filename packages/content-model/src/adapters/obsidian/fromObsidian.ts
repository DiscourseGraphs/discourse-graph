import type { BlockAnnotation, BodyAnnotation, DgDocument } from "../../schema";
import { createDgDocument } from "../../text";
import { offsetAnnotations } from "../../core/annotations";
import { parseInlineText } from "../../core/parser";

type ParsedLine = {
  depth: number;
  viewType: BlockAnnotation["attributes"]["viewType"];
  text: string;
};

const parseMarkdownLine = (line: string): ParsedLine => {
  const bulletMatch = /^(\s*)[-*]\s+(.*)$/.exec(line);
  if (bulletMatch) {
    const indentation = bulletMatch[1] ?? "";
    return {
      depth: Math.floor(indentation.replace(/\t/g, "    ").length / 2),
      viewType: "bullet",
      text: bulletMatch[2] ?? "",
    };
  }
  const numberedMatch = /^(\s*)\d+\.\s+(.*)$/.exec(line);
  if (numberedMatch) {
    const indentation = numberedMatch[1] ?? "";
    return {
      depth: Math.floor(indentation.replace(/\t/g, "    ").length / 2),
      viewType: "numbered",
      text: numberedMatch[2] ?? "",
    };
  }
  return {
    depth: 0,
    viewType: "paragraph",
    text: line,
  };
};

const blockIdFor = (index: number): string => `obsidian-block-${index + 1}`;

const parentForDepth = (
  depth: number,
  parentsByDepth: Map<number, string>,
): string | undefined => {
  if (depth === 0) return undefined;
  for (let currentDepth = depth - 1; currentDepth >= 0; currentDepth--) {
    const parent = parentsByDepth.get(currentDepth);
    if (parent) return parent;
  }
  return undefined;
};

export const obsidianMarkdownToBody = (markdown: string) => {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let inCodeFence = false;
  let codeFenceLanguage = "";
  let codeFenceStart = 0;
  let codeFenceContent = "";
  let text = "";
  const annotations: BodyAnnotation[] = [];
  const parentsByDepth = new Map<number, string>();

  lines.forEach((line, index) => {
    const fenceMatch = /^```([\w -]*)\s*$/.exec(line);
    if (fenceMatch && !inCodeFence) {
      inCodeFence = true;
      codeFenceLanguage = fenceMatch[1] ?? "";
      codeFenceStart = text.length;
      codeFenceContent = "";
      return;
    }
    if (fenceMatch && inCodeFence) {
      const content = codeFenceContent.replace(/\n$/, "");
      text += content;
      annotations.push({
        type: "code",
        start: codeFenceStart,
        end: codeFenceStart + content.length,
        attributes: {
          language: codeFenceLanguage || undefined,
          display: "block",
        },
      });
      text += "\n";
      inCodeFence = false;
      return;
    }
    if (inCodeFence) {
      codeFenceContent += `${line}\n`;
      return;
    }

    const parsed = parseMarkdownLine(line);
    const inline = parseInlineText(parsed.text);
    const blockStart = text.length;
    text += `${inline.text}\n`;
    const blockEnd = text.length;
    const blockId = blockIdFor(index);
    const block: BlockAnnotation = {
      type: "block",
      start: blockStart,
      end: blockEnd,
      attributes: {
        blockId,
        parentBlockId: parentForDepth(parsed.depth, parentsByDepth),
        depth: parsed.depth,
        viewType: parsed.viewType,
      },
    };
    parentsByDepth.set(parsed.depth, blockId);
    for (const depth of [...parentsByDepth.keys()]) {
      if (depth > parsed.depth) parentsByDepth.delete(depth);
    }
    annotations.push(
      block,
      ...offsetAnnotations(inline.annotations, blockStart),
    );
  });

  return { text, annotations };
};

export const fromObsidianMarkdown = ({
  title,
  markdown,
  metadata,
}: {
  title: string;
  markdown: string;
  metadata?: DgDocument["metadata"];
}): DgDocument =>
  createDgDocument({
    title: parseInlineText(title),
    body: obsidianMarkdownToBody(markdown),
    metadata,
  });
