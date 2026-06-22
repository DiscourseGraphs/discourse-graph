import type {
  BlockAnnotation,
  BodyAnnotation,
  DgDocument,
  InlineAnnotation,
} from "../../schema";
import { isBlockAnnotation } from "../../schema";
import { renderAnnotatedText } from "../../core/render";

const renderInlineMarkdown = (
  text: string,
  annotations: InlineAnnotation[],
): string =>
  renderAnnotatedText({
    text,
    annotations,
    renderers: {
      bold: ({ annotation }) => ({
        prefix:
          annotation.type === "bold"
            ? (annotation.attributes?.delimiter ?? "**")
            : "**",
        suffix:
          annotation.type === "bold"
            ? (annotation.attributes?.delimiter ?? "**")
            : "**",
      }),
      italics: ({ annotation }) => ({
        prefix:
          annotation.type === "italics"
            ? (annotation.attributes?.delimiter ?? "_")
            : "_",
        suffix:
          annotation.type === "italics"
            ? (annotation.attributes?.delimiter ?? "_")
            : "_",
      }),
      strikethrough: { prefix: "~~", suffix: "~~" },
      code: ({ annotation }) =>
        annotation.type === "code" && annotation.attributes.display === "block"
          ? { prefix: "```\n", suffix: "\n```" }
          : { prefix: "`", suffix: "`" },
      link: ({ annotation, content }) => ({
        prefix: "[",
        suffix: `](${annotation.type === "link" ? annotation.attributes.href : ""})`,
        replaceWith: content,
      }),
      image: ({ annotation, content }) => ({
        prefix: "![",
        suffix: `](${annotation.type === "image" ? annotation.attributes.src : ""})`,
        replaceWith:
          annotation.type === "image"
            ? (annotation.attributes.alt ?? content)
            : content,
      }),
      reference: ({ annotation, content }) => {
        if (annotation.type !== "reference") {
          return { prefix: "", suffix: "", replaceWith: content };
        }
        const attrs = annotation.attributes;
        if (attrs.kind === "obsidian-wikilink") {
          const alias =
            attrs.alias && attrs.alias !== attrs.path ? `|${attrs.alias}` : "";
          return {
            prefix: "[[",
            suffix: "]]",
            replaceWith: `${attrs.path}${attrs.subpath ?? ""}${alias}`,
          };
        }
        if (attrs.kind === "roam-block") {
          return { prefix: "((", suffix: "))", replaceWith: attrs.blockUid };
        }
        return { prefix: "[[", suffix: "]]", replaceWith: content };
      },
    },
  });

const linePrefix = (block: BlockAnnotation): string => {
  const indent = "  ".repeat(block.attributes.depth);
  if (block.attributes.viewType === "bullet") return `${indent}- `;
  if (block.attributes.viewType === "numbered") return `${indent}1. `;
  return indent;
};

const inlineForBlock = (
  annotations: BodyAnnotation[],
  block: BlockAnnotation,
): InlineAnnotation[] =>
  annotations
    .filter(
      (annotation): annotation is InlineAnnotation =>
        !isBlockAnnotation(annotation) &&
        annotation.start >= block.start &&
        annotation.end <= block.end,
    )
    .map((annotation) => ({
      ...annotation,
      start: annotation.start - block.start,
      end: annotation.end - block.start,
    }));

export const toObsidianMarkdown = (document: DgDocument): string => {
  const blocks = document.body.annotations
    .filter(isBlockAnnotation)
    .sort((a, b) => a.start - b.start);
  if (blocks.length === 0) return document.body.text;

  return blocks
    .map((block) => {
      const raw = document.body.text
        .slice(block.start, block.end)
        .replace(/\n$/, "");
      const rendered = renderInlineMarkdown(
        raw,
        inlineForBlock(document.body.annotations, block),
      );
      return `${linePrefix(block)}${rendered}`;
    })
    .join("\n");
};
