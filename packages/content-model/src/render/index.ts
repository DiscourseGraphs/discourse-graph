import { renderInlineText, type ParsedInlineText } from "../core";
import type {
  DgBlockAnnotation,
  DgDocument,
  DgInlineAnnotation,
  DgText,
} from "../schema";
import { assertDgDocument } from "../validation";

export type RenderFormat = "html";

const escapeHtml = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const sanitizeUrl = (value: string): string => {
  const normalized = value.trim();
  if (/^(?:javascript|vbscript|data):/i.test(normalized)) return "#";
  return normalized;
};

const referenceHref = (annotation: DgInlineAnnotation): string => {
  if (annotation.type !== "reference") return "#";
  return `dg://${annotation.referenceType}/${encodeURIComponent(annotation.target)}`;
};

const htmlAnnotationOpen = (annotation: DgInlineAnnotation): string => {
  switch (annotation.type) {
    case "bold":
      return "<strong>";
    case "italic":
      return "<em>";
    case "strikethrough":
      return "<s>";
    case "inline-code":
      return "<code>";
    case "link":
      return `<a href="${escapeHtml(sanitizeUrl(annotation.href))}"${
        annotation.title === undefined
          ? ""
          : ` title="${escapeHtml(annotation.title)}"`
      }>`;
    case "reference":
      if (annotation.referenceType === "image") {
        return `<img src="${escapeHtml(sanitizeUrl(annotation.target))}" alt="`;
      }
      return `<a href="${escapeHtml(referenceHref(annotation))}" data-dg-reference="${annotation.referenceType}">`;
  }
};

const htmlAnnotationClose = (annotation: DgInlineAnnotation): string => {
  switch (annotation.type) {
    case "bold":
      return "</strong>";
    case "italic":
      return "</em>";
    case "strikethrough":
      return "</s>";
    case "inline-code":
      return "</code>";
    case "link":
      return "</a>";
    case "reference":
      return annotation.referenceType === "image" ? '">' : "</a>";
  }
};

export const renderDgTextToHtml = (value: ParsedInlineText): string =>
  renderInlineText({
    value,
    renderer: { open: htmlAnnotationOpen, close: htmlAnnotationClose },
    escapeText: escapeHtml,
  });

const getInlineSlice = ({
  body,
  block,
}: {
  body: DgText;
  block: DgBlockAnnotation;
}): ParsedInlineText => ({
  text: body.text.slice(block.start, block.end),
  annotations: body.annotations.flatMap((annotation) => {
    if (
      annotation.type === "block" ||
      annotation.start < block.start ||
      annotation.end > block.end
    ) {
      return [];
    }
    return [
      {
        ...annotation,
        start: annotation.start - block.start,
        end: annotation.end - block.start,
      },
    ];
  }),
});

type RenderableBlock = {
  annotation: DgBlockAnnotation;
  children: RenderableBlock[];
};

const buildBlockTree = (
  blocks: readonly DgBlockAnnotation[],
): RenderableBlock[] => {
  const renderableById = new Map<string, RenderableBlock>(
    blocks.map((annotation) => [annotation.id, { annotation, children: [] }]),
  );
  const roots: RenderableBlock[] = [];
  blocks.forEach((annotation) => {
    const renderable = renderableById.get(annotation.id);
    if (renderable === undefined) return;
    const parent =
      annotation.parentId === undefined
        ? undefined
        : renderableById.get(annotation.parentId);
    if (parent === undefined) roots.push(renderable);
    else parent.children.push(renderable);
  });
  return roots;
};

const renderBlocks = ({
  blocks,
  body,
}: {
  blocks: readonly RenderableBlock[];
  body: DgText;
}): string => {
  let html = "";
  let index = 0;
  while (index < blocks.length) {
    const block = blocks[index];
    if (block === undefined) break;
    if (block.annotation.blockType === "list-item") {
      const listStyle = block.annotation.attributes?.listStyle ?? "bullet";
      const listItems: RenderableBlock[] = [];
      while (
        index < blocks.length &&
        blocks[index]?.annotation.blockType === "list-item" &&
        (blocks[index]?.annotation.attributes?.listStyle ?? "bullet") ===
          listStyle
      ) {
        listItems.push(blocks[index] as RenderableBlock);
        index += 1;
      }
      const listTag = listStyle === "number" ? "ol" : "ul";
      html += `<${listTag}>${listItems
        .map(
          (item) =>
            `<li>${renderDgTextToHtml(
              getInlineSlice({ body, block: item.annotation }),
            )}${renderBlocks({ blocks: item.children, body })}</li>`,
        )
        .join("")}</${listTag}>`;
      continue;
    }

    const inline = getInlineSlice({ body, block: block.annotation });
    const children = renderBlocks({ blocks: block.children, body });
    switch (block.annotation.blockType) {
      case "heading": {
        const level = Math.min(
          Math.max(block.annotation.attributes?.level ?? 2, 1),
          6,
        );
        html += `<h${level}>${renderDgTextToHtml(inline)}</h${level}>${children}`;
        break;
      }
      case "paragraph":
        html += `<p>${renderDgTextToHtml(inline)}</p>${children}`;
        break;
      case "blockquote":
        html += `<blockquote>${renderDgTextToHtml(inline)}${children}</blockquote>`;
        break;
      case "code-block": {
        const language = block.annotation.attributes?.language;
        const languageClass =
          language === undefined
            ? ""
            : ` class="language-${escapeHtml(language)}"`;
        html += `<pre><code${languageClass}>${escapeHtml(inline.text)}</code></pre>${children}`;
        break;
      }
    }
    index += 1;
  }
  return html;
};

export const renderDgDocumentToHtml = ({
  document,
}: {
  document: DgDocument;
}): string => {
  assertDgDocument(document);
  const title = renderDgTextToHtml({
    text: document.title.text,
    annotations: document.title.annotations.filter(
      (annotation): annotation is DgInlineAnnotation =>
        annotation.type !== "block",
    ),
  });
  const blocks = document.body.annotations
    .filter(
      (annotation): annotation is DgBlockAnnotation =>
        annotation.type === "block",
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const body =
    blocks.length === 0
      ? document.body.text === ""
        ? ""
        : `<p>${renderDgTextToHtml({
            text: document.body.text,
            annotations: document.body.annotations.filter(
              (annotation): annotation is DgInlineAnnotation =>
                annotation.type !== "block",
            ),
          })}</p>`
      : renderBlocks({ blocks: buildBlockTree(blocks), body: document.body });
  return `<article class="dg-document"><h1>${title}</h1>${body}</article>`;
};
