import { NULL_INLINE_CONTENT } from "../constants";
import {
  getInlineAnnotationsForRange,
  renderAnnotatedText,
} from "../core/render";
import type { BlockAnnotation, DgDocument, InlineAnnotation } from "../schema";

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const sanitizeUrl = (value: string): string => {
  const trimmed = value.trim();
  const schemeMatch = /^([a-zA-Z][a-zA-Z\d+.-]*):/.exec(trimmed);
  if (!schemeMatch) return trimmed;
  const scheme = schemeMatch[1]?.toLowerCase();
  return scheme === "http" || scheme === "https" || scheme === "mailto"
    ? trimmed
    : "#";
};

const escapeHtmlWithIndexMap = (
  value: string,
): { text: string; indexMap: number[] } => {
  let text = "";
  const indexMap = [0];
  for (let index = 0; index < value.length; index++) {
    const character = value[index] ?? "";
    text += escapeHtml(character);
    indexMap.push(text.length);
  }
  return { text, indexMap };
};

const mapAnnotationsToEscapedText = ({
  annotations,
  indexMap,
}: {
  annotations: InlineAnnotation[];
  indexMap: number[];
}): InlineAnnotation[] =>
  annotations.map((annotation) => ({
    ...annotation,
    start: indexMap[annotation.start] ?? annotation.start,
    end: indexMap[annotation.end] ?? annotation.end,
  }));

const renderInlineHtml = ({
  text,
  annotations,
}: {
  text: string;
  annotations: InlineAnnotation[];
}): string => {
  const escaped = escapeHtmlWithIndexMap(text);
  return renderAnnotatedText({
    text: escaped.text,
    annotations: mapAnnotationsToEscapedText({
      annotations,
      indexMap: escaped.indexMap,
    }),
    renderers: {
      bold: () => ({ prefix: "<strong>", suffix: "</strong>" }),
      italics: () => ({ prefix: "<em>", suffix: "</em>" }),
      strikethrough: () => ({ prefix: "<s>", suffix: "</s>" }),
      code: () => ({ prefix: "<code>", suffix: "</code>" }),
      link: ({ annotation }) => ({
        prefix: `<a href="${escapeHtml(sanitizeUrl(annotation.attributes.href))}">`,
        suffix: "</a>",
      }),
      image: ({ annotation }) => ({
        prefix: `<img src="${escapeHtml(sanitizeUrl(annotation.attributes.src))}" alt="${escapeHtml(annotation.attributes.alt ?? "")}" />`,
        suffix: "",
        replace: true,
      }),
      reference: ({ annotation, content }) => {
        const attributes = annotation.attributes;
        const target =
          attributes.kind === "roam-block"
            ? attributes.blockUid
            : attributes.kind === "roam-page"
              ? attributes.pageTitle
              : attributes.path;
        return {
          prefix: `<a data-reference-kind="${attributes.kind}" href="#${escapeHtml(target)}">`,
          suffix: "</a>",
          replace: content === NULL_INLINE_CONTENT,
        };
      },
    },
  }).replaceAll(NULL_INLINE_CONTENT, "");
};

export const dgDocumentToHtml = (document: DgDocument): string => {
  const title = renderInlineHtml({
    text: document.title.text,
    annotations: document.title.annotations,
  });
  const blocks = document.body.annotations
    .filter(
      (annotation): annotation is BlockAnnotation =>
        annotation.type === "block",
    )
    .sort((a, b) => a.start - b.start);

  const body =
    blocks.length > 0
      ? blocks
          .map((block) => {
            const text = document.body.text
              .slice(block.start, block.end)
              .replace(/\n$/, "");
            const inline = renderInlineHtml({
              text,
              annotations: getInlineAnnotationsForRange({
                annotations: document.body.annotations,
                start: block.start,
                end: block.end,
              }),
            });
            const tag = block.attributes.viewType === "paragraph" ? "p" : "li";
            return `<${tag} data-block-id="${escapeHtml(block.attributes.blockId)}">${inline}</${tag}>`;
          })
          .join("\n")
      : renderInlineHtml({
          text: document.body.text,
          annotations: document.body.annotations.filter(
            (annotation): annotation is InlineAnnotation =>
              annotation.type !== "block",
          ),
        });

  return `<article><h1>${title}</h1>\n${body}</article>`;
};
