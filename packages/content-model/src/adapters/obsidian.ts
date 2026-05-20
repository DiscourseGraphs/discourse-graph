import { NULL_INLINE_CONTENT } from "../constants";
import {
  getInlineAnnotationsForRange,
  renderInlineToObsidianMarkdown,
} from "../core/render";
import {
  createDgDocument,
  parseInline,
  parseMarkdownBody,
  stripYamlFrontmatter,
} from "../core/parse";
import type {
  BlockAnnotation,
  DgDocument,
  InlineAnnotation,
  JsonObject,
} from "../schema";

export const obsidianMarkdownToDgDocument = ({
  title,
  markdown,
  metadata = {},
}: {
  title: string;
  markdown: string;
  metadata?: JsonObject;
}): DgDocument => {
  const { frontmatter, body } = stripYamlFrontmatter(markdown);
  const parsedTitle = parseInline(title, { dialect: "obsidian" });
  const parsedBody = parseMarkdownBody({
    markdown: body,
    dialect: "obsidian",
    blockIdPrefix: "obsidian-block",
  });
  return createDgDocument({
    title: parsedTitle.text,
    titleAnnotations: parsedTitle.annotations,
    body: parsedBody.text,
    bodyAnnotations: parsedBody.annotations,
    metadata: {
      ...metadata,
      source: "obsidian",
      ...(frontmatter !== null ? { frontmatter } : {}),
    },
  });
};

const renderObsidianBlock = ({
  document,
  block,
  isFirstBlock,
  previousBlock,
}: {
  document: DgDocument;
  block: BlockAnnotation;
  isFirstBlock: boolean;
  previousBlock?: BlockAnnotation;
}): string => {
  const rawBlockText = document.body.text
    .slice(block.start, block.end)
    .replace(/\n$/, "");
  const inlineAnnotations = getInlineAnnotationsForRange({
    annotations: document.body.annotations,
    start: block.start,
    end: block.end,
  });
  const rendered = renderInlineToObsidianMarkdown({
    text: rawBlockText,
    annotations: inlineAnnotations,
  }).replaceAll(NULL_INLINE_CONTENT, "");
  const indent = "\t".repeat(block.attributes.depth);
  const marker =
    block.attributes.viewType === "bullet"
      ? "- "
      : block.attributes.viewType === "numbered"
        ? "1. "
        : "";
  const paragraphBreak =
    !isFirstBlock &&
    (block.attributes.viewType === "paragraph" ||
      previousBlock?.attributes.viewType === "paragraph")
      ? "\n"
      : "";
  return `${paragraphBreak}${indent}${marker}${rendered}`;
};

const isInlineAnnotation = (
  annotation: DgDocument["body"]["annotations"][number],
): annotation is InlineAnnotation => annotation.type !== "block";

export const dgDocumentToObsidianMarkdown = (document: DgDocument): string => {
  const blocks = document.body.annotations
    .filter(
      (annotation): annotation is BlockAnnotation =>
        annotation.type === "block",
    )
    .sort((a, b) => a.start - b.start);

  if (blocks.length === 0) {
    return renderInlineToObsidianMarkdown({
      text: document.body.text,
      annotations: document.body.annotations.filter(isInlineAnnotation),
    }).replaceAll(NULL_INLINE_CONTENT, "");
  }

  return blocks
    .map((block, index) =>
      renderObsidianBlock({
        document,
        block,
        isFirstBlock: index === 0,
        previousBlock: blocks[index - 1],
      }),
    )
    .join("\n");
};
