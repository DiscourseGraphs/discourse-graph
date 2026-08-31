import {
  parseInlineText,
  renderInlineText,
  type InlineParseRule,
  type ParsedInlineText,
} from "../core";
import {
  dgDocumentSchemaVersion,
  type DgAnnotation,
  type DgBlockAnnotation,
  type DgDocument,
  type DgInlineAnnotation,
  type DgListStyle,
  type DgText,
} from "../schema";
import { assertDgDocument } from "../validation";
import { markdownInlineRules } from "./inline";

export type RoamViewType = "bullet" | "number" | "document";

export type RoamTreeNode = {
  uid: string;
  text: string;
  children?: RoamTreeNode[];
  heading?: number;
  viewType?: RoamViewType;
};

export type RoamPage = {
  uid: string;
  title: string;
  children: RoamTreeNode[];
  viewType?: RoamViewType;
};

const roamBlockReferenceRule: InlineParseRule = ({ source, index }) => {
  const match = /^\(\(([^)]+)\)\)/.exec(source.slice(index));
  if (match === null) return null;
  const target = match[1] ?? "";
  return {
    length: match[0].length,
    content: target,
    createAnnotation: ({ start, end }) => ({
      type: "reference",
      referenceType: "block",
      target,
      start,
      end,
    }),
  };
};

const roamPageTagRule: InlineParseRule = ({ source, index }) => {
  const match = /^#\[\[([^\]]+)\]\]/.exec(source.slice(index));
  if (match === null) return null;
  const target = match[1] ?? "";
  return {
    length: match[0].length,
    content: target,
    createAnnotation: ({ start, end }) => ({
      type: "reference",
      referenceType: "tag",
      target,
      start,
      end,
    }),
  };
};

const roamInlineRules: readonly InlineParseRule[] = [
  roamPageTagRule,
  roamBlockReferenceRule,
  ...markdownInlineRules,
];

export const parseRoamInline = (source: string): ParsedInlineText =>
  parseInlineText({ source, rules: roamInlineRules });

const escapeLinkTarget = (target: string): string =>
  target.replaceAll("\\", "\\\\").replaceAll(")", "\\)");

const roamAnnotationOpen = (annotation: DgInlineAnnotation): string => {
  switch (annotation.type) {
    case "bold":
      return "**";
    case "italic":
      return "__";
    case "strikethrough":
      return "~~";
    case "inline-code":
      return "`";
    case "link":
      return "[";
    case "reference":
      switch (annotation.referenceType) {
        case "block":
          return "((";
        case "image":
          return "![";
        case "tag":
          return annotation.target.includes(" ") ? "#[[" : "#";
        case "page":
          return `[[${annotation.target}|`;
      }
  }
};

const roamAnnotationClose = (annotation: DgInlineAnnotation): string => {
  switch (annotation.type) {
    case "bold":
      return "**";
    case "italic":
      return "__";
    case "strikethrough":
      return "~~";
    case "inline-code":
      return "`";
    case "link":
      return `](${escapeLinkTarget(annotation.href)}${
        annotation.title === undefined ? "" : ` "${annotation.title}"`
      })`;
    case "reference":
      switch (annotation.referenceType) {
        case "block":
          return "))";
        case "image":
          return `](${escapeLinkTarget(annotation.target)})`;
        case "tag":
          return annotation.target.includes(" ") ? "]]" : "";
        case "page":
          return "]]";
      }
  }
};

export const renderRoamInline = (value: ParsedInlineText): string =>
  renderInlineText({
    value,
    renderer: { open: roamAnnotationOpen, close: roamAnnotationClose },
  });

const getListStyle = (viewType: RoamViewType | undefined): DgListStyle =>
  viewType === "number" ? "number" : "bullet";

const parseRoamBlockText = ({
  node,
}: {
  node: RoamTreeNode;
}): {
  text: string;
  annotations: DgInlineAnnotation[];
  blockType: DgBlockAnnotation["blockType"];
  language?: string;
} => {
  const codeBlock = /^```([^\n`]*)\n([\s\S]*?)\n```$/.exec(node.text);
  if (codeBlock !== null) {
    return {
      text: codeBlock[2] ?? "",
      annotations: [],
      blockType: "code-block",
      language: codeBlock[1] || undefined,
    };
  }
  const parsed = parseRoamInline(node.text);
  return {
    ...parsed,
    blockType: node.heading ? "heading" : "list-item",
  };
};

const roamPageBodyToDgText = (page: RoamPage): DgText => {
  let text = "";
  const annotations: DgAnnotation[] = [];
  let isFirstBlock = true;

  const visit = ({
    node,
    parentId,
    depth,
    inheritedViewType,
  }: {
    node: RoamTreeNode;
    parentId?: string;
    depth: number;
    inheritedViewType: RoamViewType;
  }): void => {
    if (!isFirstBlock) text += "\n";
    isFirstBlock = false;
    const parsed = parseRoamBlockText({ node });
    const start = text.length;
    text += parsed.text;
    const end = text.length;
    annotations.push(
      ...parsed.annotations.map((annotation) => ({
        ...annotation,
        start: annotation.start + start,
        end: annotation.end + start,
      })),
      {
        type: "block",
        id: node.uid,
        ...(parentId === undefined ? {} : { parentId }),
        blockType: parsed.blockType,
        attributes: {
          sourceId: node.uid,
          depth,
          ...(parsed.blockType === "heading"
            ? { level: Math.min(Math.max(node.heading ?? 1, 1), 6) }
            : { listStyle: getListStyle(node.viewType ?? inheritedViewType) }),
          ...(parsed.language === undefined
            ? {}
            : { language: parsed.language }),
        },
        start,
        end,
      },
    );

    const childViewType = node.viewType ?? inheritedViewType;
    (node.children ?? []).forEach((child) =>
      visit({
        node: child,
        parentId: node.uid,
        depth: depth + 1,
        inheritedViewType: childViewType,
      }),
    );
  };

  page.children.forEach((node) =>
    visit({
      node,
      depth: 0,
      inheritedViewType: page.viewType ?? "bullet",
    }),
  );
  return { text, annotations };
};

export const roamTreeToDgDocument = ({
  page,
}: {
  page: RoamPage;
}): DgDocument =>
  assertDgDocument({
    version: dgDocumentSchemaVersion,
    title: parseRoamInline(page.title),
    body: roamPageBodyToDgText(page),
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

const blockToRoamNode = ({
  block,
  body,
}: {
  block: DgBlockAnnotation;
  body: DgText;
}): RoamTreeNode => {
  const inline = getInlineSlice({ body, block });
  const text =
    block.blockType === "code-block"
      ? `\`\`\`${block.attributes?.language ?? ""}\n${inline.text}\n\`\`\``
      : renderRoamInline(inline);
  return {
    uid: block.attributes?.sourceId ?? block.id,
    text,
    children: [],
    ...(block.blockType === "heading"
      ? { heading: block.attributes?.level ?? 1 }
      : {}),
    ...(block.blockType === "list-item"
      ? {
          viewType:
            block.attributes?.listStyle === "number" ? "number" : "bullet",
        }
      : {}),
  };
};

export const dgDocumentToRoamTree = ({
  document,
  pageUid,
}: {
  document: DgDocument;
  pageUid: string;
}): RoamPage => {
  assertDgDocument(document);
  const blocks = document.body.annotations
    .filter(
      (annotation): annotation is DgBlockAnnotation =>
        annotation.type === "block",
    )
    .sort((left, right) => left.start - right.start || left.end - right.end);
  const nodesByBlockId = new Map(
    blocks.map((block) => [
      block.id,
      blockToRoamNode({ block, body: document.body }),
    ]),
  );
  const roots: RoamTreeNode[] = [];
  blocks.forEach((block) => {
    const node = nodesByBlockId.get(block.id);
    if (node === undefined) return;
    const parent =
      block.parentId === undefined
        ? undefined
        : nodesByBlockId.get(block.parentId);
    if (parent === undefined) roots.push(node);
    else parent.children?.push(node);
  });

  return {
    uid: pageUid,
    title: renderRoamInline({
      text: document.title.text,
      annotations: document.title.annotations.filter(
        (annotation): annotation is DgInlineAnnotation =>
          annotation.type !== "block",
      ),
    }),
    children: roots,
    viewType: "bullet",
  };
};
