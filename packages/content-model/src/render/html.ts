import type { BlockAnnotation, DgDocument, InlineAnnotation } from "../schema";
import { isBlockAnnotation } from "../schema";
import { renderAnnotatedText } from "../core/render";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const renderInlineHtml = (
  text: string,
  annotations: InlineAnnotation[],
): string =>
  renderAnnotatedText({
    text: escapeHtml(text),
    annotations,
    renderers: {
      bold: { prefix: "<strong>", suffix: "</strong>" },
      italics: { prefix: "<em>", suffix: "</em>" },
      strikethrough: { prefix: "<s>", suffix: "</s>" },
      code: { prefix: "<code>", suffix: "</code>" },
      link: ({ annotation, content }) => ({
        prefix: `<a href="${escapeHtml(
          annotation.type === "link" ? annotation.attributes.href : "",
        )}">`,
        suffix: "</a>",
        replaceWith: content,
      }),
      image: ({ annotation }) => ({
        prefix: "",
        suffix: "",
        replaceWith:
          annotation.type === "image"
            ? `<img src="${escapeHtml(annotation.attributes.src)}" alt="${escapeHtml(
                annotation.attributes.alt ?? "",
              )}">`
            : "",
      }),
      reference: ({ annotation, content }) => ({
        prefix: `<span data-reference-kind="${escapeHtml(
          annotation.type === "reference" ? annotation.attributes.kind : "",
        )}">`,
        suffix: "</span>",
        replaceWith: content,
      }),
    },
  });

const inlineForBlock = (
  document: DgDocument,
  block: BlockAnnotation,
): InlineAnnotation[] =>
  document.body.annotations
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

export const toHtml = (document: DgDocument): string => {
  const title = renderInlineHtml(
    document.title.text,
    document.title.annotations,
  );
  const blocks = document.body.annotations
    .filter(isBlockAnnotation)
    .sort((a, b) => a.start - b.start);
  const body = blocks
    .map((block) => {
      const raw = document.body.text
        .slice(block.start, block.end)
        .replace(/\n$/, "");
      const content = renderInlineHtml(raw, inlineForBlock(document, block));
      if (block.attributes.viewType === "bullet") {
        return `<li data-block-id="${escapeHtml(block.attributes.blockId)}">${content}</li>`;
      }
      if (block.attributes.viewType === "numbered") {
        return `<li data-block-id="${escapeHtml(block.attributes.blockId)}" data-list-type="numbered">${content}</li>`;
      }
      return `<p data-block-id="${escapeHtml(block.attributes.blockId)}">${content}</p>`;
    })
    .join("");
  return `<article><h1>${title}</h1>${body}</article>`;
};
