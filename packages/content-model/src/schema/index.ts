export const dgDocumentSchemaVersion = 1 as const;

export type DgDocumentSchemaVersion = typeof dgDocumentSchemaVersion;

export type DgSpan = {
  start: number;
  end: number;
};

export type DgTextStyleAnnotation = DgSpan & {
  type: "bold" | "italic" | "strikethrough" | "inline-code";
};

export type DgLinkAnnotation = DgSpan & {
  type: "link";
  href: string;
  title?: string;
};

export type DgReferenceKind = "page" | "block" | "image" | "tag";

export type DgReferenceAnnotation = DgSpan & {
  type: "reference";
  referenceType: DgReferenceKind;
  target: string;
  label?: string;
  transclusion?: boolean;
};

export type DgInlineAnnotation =
  | DgTextStyleAnnotation
  | DgLinkAnnotation
  | DgReferenceAnnotation;

export type DgBlockType =
  | "paragraph"
  | "heading"
  | "list-item"
  | "blockquote"
  | "code-block";

export type DgListStyle = "bullet" | "number";

export type DgBlockAttributes = {
  level?: number;
  listStyle?: DgListStyle;
  depth?: number;
  checked?: boolean;
  language?: string;
  sourceId?: string;
};

export type DgBlockAnnotation = DgSpan & {
  type: "block";
  id: string;
  parentId?: string;
  blockType: DgBlockType;
  attributes?: DgBlockAttributes;
};

export type DgAnnotation = DgInlineAnnotation | DgBlockAnnotation;

export type DgText = {
  text: string;
  annotations: DgAnnotation[];
};

export type DgDocument = {
  version: DgDocumentSchemaVersion;
  title: DgText;
  body: DgText;
};

export const isDgBlockAnnotation = (
  annotation: DgAnnotation,
): annotation is DgBlockAnnotation => annotation.type === "block";

export const isDgInlineAnnotation = (
  annotation: DgAnnotation,
): annotation is DgInlineAnnotation => annotation.type !== "block";
