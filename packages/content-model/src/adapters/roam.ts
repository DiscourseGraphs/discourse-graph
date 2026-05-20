import { NULL_INLINE_CONTENT } from "../constants";
import {
  getInlineAnnotationsForRange,
  renderInlineToRoam,
} from "../core/render";
import {
  createDgDocument,
  parseInline,
  parseMarkdownBody,
} from "../core/parse";
import type {
  BlockAnnotation,
  BodyAnnotation,
  DgDocument,
  InlineAnnotation,
  JsonObject,
} from "../schema";

export type RoamViewType = "bullet" | "numbered" | "document";

export type RoamTreeNode = {
  uid: string;
  text: string;
  viewType?: RoamViewType;
  children?: RoamTreeNode[];
};

export type RoamRenderedBlock = {
  uid?: string;
  text: string;
  viewType: RoamViewType;
  children: RoamRenderedBlock[];
};

const roamViewTypeToBlockViewType = (
  viewType?: RoamViewType,
): "paragraph" | "bullet" | "numbered" => {
  if (viewType === "numbered") return "numbered";
  if (viewType === "document") return "paragraph";
  return "bullet";
};

const blockViewTypeToRoamViewType = (
  viewType: "paragraph" | "bullet" | "numbered",
): RoamViewType => {
  if (viewType === "paragraph") return "document";
  return viewType;
};

const appendRoamTreeNode = ({
  node,
  depth,
  parentBlockId,
  state,
}: {
  node: RoamTreeNode;
  depth: number;
  parentBlockId?: string;
  state: { text: string; annotations: BodyAnnotation[] };
}): void => {
  const parsed = parseInline(node.text, { dialect: "roam" });
  const start = state.text.length;
  state.text += `${parsed.text || NULL_INLINE_CONTENT}\n`;
  const end = state.text.length;
  state.annotations.push({
    type: "block",
    start,
    end,
    attributes: {
      blockId: node.uid,
      parentBlockId,
      depth,
      viewType: roamViewTypeToBlockViewType(node.viewType),
    },
  });
  state.annotations.push(
    ...parsed.annotations.map((annotation) => ({
      ...annotation,
      start: annotation.start + start,
      end: annotation.end + start,
    })),
  );
  for (const child of node.children ?? []) {
    appendRoamTreeNode({
      node: child,
      depth: depth + 1,
      parentBlockId: node.uid,
      state,
    });
  }
};

export const roamTreeToDgDocument = ({
  title,
  pageUid,
  children,
  metadata = {},
}: {
  title: string;
  pageUid?: string;
  children: RoamTreeNode[];
  metadata?: JsonObject;
}): DgDocument => {
  const parsedTitle = parseInline(title, { dialect: "roam" });
  const state: { text: string; annotations: BodyAnnotation[] } = {
    text: "",
    annotations: [],
  };
  for (const child of children) {
    appendRoamTreeNode({ node: child, depth: 0, state });
  }
  return createDgDocument({
    title: parsedTitle.text,
    titleAnnotations: parsedTitle.annotations,
    body: state.text,
    bodyAnnotations: state.annotations,
    metadata: {
      ...metadata,
      source: "roam",
      ...(pageUid ? { pageUid } : {}),
    },
  });
};

export const roamTextToDgDocument = ({
  title,
  text,
  sourceLocalId,
  metadata = {},
}: {
  title: string;
  text: string;
  sourceLocalId?: string;
  metadata?: JsonObject;
}): DgDocument => {
  const parsedTitle = parseInline(title, { dialect: "roam" });
  const parsedBody = parseMarkdownBody({
    markdown: text,
    dialect: "roam",
    blockIdPrefix: sourceLocalId ?? "roam-block",
  });
  return createDgDocument({
    title: parsedTitle.text,
    titleAnnotations: parsedTitle.annotations,
    body: parsedBody.text,
    bodyAnnotations: parsedBody.annotations,
    metadata: {
      ...metadata,
      source: "roam",
      ...(sourceLocalId ? { sourceLocalId } : {}),
    },
  });
};

const renderRoamBlockText = ({
  document,
  block,
}: {
  document: DgDocument;
  block: BlockAnnotation;
}): string => {
  const rawBlockText = document.body.text
    .slice(block.start, block.end)
    .replace(/\n$/, "");
  return renderInlineToRoam({
    text: rawBlockText,
    annotations: getInlineAnnotationsForRange({
      annotations: document.body.annotations,
      start: block.start,
      end: block.end,
    }),
  }).replaceAll(NULL_INLINE_CONTENT, "");
};

export const dgDocumentToRoamMarkdown = (document: DgDocument): string => {
  const blocks = document.body.annotations
    .filter(
      (annotation): annotation is BlockAnnotation =>
        annotation.type === "block",
    )
    .sort((a, b) => a.start - b.start);

  if (blocks.length === 0) {
    const inlineAnnotations = document.body.annotations.filter(
      (annotation): annotation is InlineAnnotation =>
        annotation.type !== "block",
    );
    return renderInlineToRoam({
      text: document.body.text,
      annotations: inlineAnnotations,
    }).replaceAll(NULL_INLINE_CONTENT, "");
  }

  return blocks
    .map((block) => {
      const indent = "  ".repeat(block.attributes.depth);
      const marker =
        block.attributes.viewType === "numbered"
          ? "1. "
          : block.attributes.viewType === "bullet"
            ? "- "
            : "";
      return `${indent}${marker}${renderRoamBlockText({ document, block })}`;
    })
    .join("\n");
};

export const dgDocumentToRoamBlocks = (
  document: DgDocument,
): RoamRenderedBlock[] => {
  const blocks = document.body.annotations
    .filter(
      (annotation): annotation is BlockAnnotation =>
        annotation.type === "block",
    )
    .sort((a, b) => a.start - b.start);
  const byId = new Map<string, RoamRenderedBlock>();
  const roots: RoamRenderedBlock[] = [];

  for (const block of blocks) {
    const renderedBlock: RoamRenderedBlock = {
      uid: block.attributes.blockId,
      text: renderRoamBlockText({ document, block }),
      viewType: blockViewTypeToRoamViewType(block.attributes.viewType),
      children: [],
    };
    byId.set(block.attributes.blockId, renderedBlock);
    const parentId = block.attributes.parentBlockId;
    const parent = parentId ? byId.get(parentId) : undefined;
    if (parent) {
      parent.children.push(renderedBlock);
    } else {
      roots.push(renderedBlock);
    }
  }

  return roots;
};
