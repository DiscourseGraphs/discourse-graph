import type {
  BlockAnnotation,
  DgDocument,
  InlineAnnotation,
} from "../../schema";
import { isBlockAnnotation } from "../../schema";
import { renderAnnotatedText } from "../../core/render";
import type { RoamTreeNode } from "./fromRoam";

const renderInlineRoam = (
  text: string,
  annotations: InlineAnnotation[],
): string =>
  renderAnnotatedText({
    text,
    annotations,
    renderers: {
      bold: { prefix: "**", suffix: "**" },
      italics: { prefix: "__", suffix: "__" },
      strikethrough: { prefix: "~~", suffix: "~~" },
      code: { prefix: "`", suffix: "`" },
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
        if (attrs.kind === "roam-block") {
          return { prefix: "((", suffix: "))", replaceWith: attrs.blockUid };
        }
        if (attrs.kind === "roam-page") {
          const kind = annotation.appAttributes?.roam?.kind;
          if (kind === "hash" && /^[A-Za-z0-9_.-]+$/.test(attrs.pageTitle)) {
            return { prefix: "#", suffix: "", replaceWith: attrs.pageTitle };
          }
          return { prefix: "[[", suffix: "]]", replaceWith: attrs.pageTitle };
        }
        return { prefix: "[[", suffix: "]]", replaceWith: content };
      },
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

export const toRoamTree = (document: DgDocument): RoamTreeNode[] => {
  const blocks = document.body.annotations
    .filter(isBlockAnnotation)
    .sort((a, b) => a.start - b.start);
  const byId = new Map<string, RoamTreeNode>();
  const roots: RoamTreeNode[] = [];

  for (const block of blocks) {
    const raw = document.body.text
      .slice(block.start, block.end)
      .replace(/\n$/, "");
    const node: RoamTreeNode = {
      uid: block.attributes.blockId,
      text: renderInlineRoam(raw, inlineForBlock(document, block)),
      viewType:
        block.attributes.viewType === "paragraph"
          ? "document"
          : block.attributes.viewType,
      children: [],
    };
    byId.set(node.uid, node);
    const parent = block.attributes.parentBlockId
      ? byId.get(block.attributes.parentBlockId)
      : undefined;
    if (parent) {
      parent.children = [...(parent.children ?? []), node];
    } else {
      roots.push(node);
    }
  }

  return roots;
};

export const toRoamMarkdown = (document: DgDocument): string => {
  const renderNode = (node: RoamTreeNode, depth: number): string => {
    const prefix = "  ".repeat(depth);
    const marker = node.viewType === "numbered" ? "1. " : "- ";
    const children = (node.children ?? [])
      .map((child) => renderNode(child, depth + 1))
      .join("\n");
    return `${prefix}${marker}${node.text}${children ? `\n${children}` : ""}`;
  };
  return toRoamTree(document)
    .map((node) => renderNode(node, 0))
    .join("\n");
};
