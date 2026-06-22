import { DG_DOCUMENT_VERSION } from "./constants";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue | undefined }
  | JsonValue[];

export type JsonObject = Record<string, JsonValue | undefined>;

export type AppAttributes = Record<string, JsonObject>;

export type AnnotationBase = {
  start: number;
  end: number;
  appAttributes?: AppAttributes;
};

export type BlockAnnotation = AnnotationBase & {
  type: "block";
  attributes: {
    blockId: string;
    parentBlockId?: string;
    depth: number;
    viewType: "paragraph" | "bullet" | "numbered";
  };
};

export type BoldAnnotation = AnnotationBase & {
  type: "bold";
  attributes?: {
    delimiter?: string;
    open?: boolean;
  };
};

export type ItalicsAnnotation = AnnotationBase & {
  type: "italics";
  attributes?: {
    delimiter?: string;
    open?: boolean;
  };
};

export type StrikethroughAnnotation = AnnotationBase & {
  type: "strikethrough";
  attributes?: {
    delimiter?: string;
    open?: boolean;
  };
};

export type CodeAnnotation = AnnotationBase & {
  type: "code";
  attributes: {
    language?: string;
    ticks?: number;
    display?: "inline" | "block";
  };
};

export type LinkAnnotation = AnnotationBase & {
  type: "link";
  attributes: {
    href: string;
    title?: string;
  };
};

export type ImageAnnotation = AnnotationBase & {
  type: "image";
  attributes: {
    src: string;
    alt?: string;
    title?: string;
  };
};

export type ReferenceAnnotation = AnnotationBase & {
  type: "reference";
  attributes:
    | {
        kind: "roam-page";
        pageTitle: string;
        pageUid?: string;
      }
    | {
        kind: "roam-block";
        blockUid: string;
      }
    | {
        kind: "obsidian-wikilink";
        path: string;
        subpath?: string;
        alias?: string;
      };
};

export type InlineAnnotation =
  | BoldAnnotation
  | ItalicsAnnotation
  | StrikethroughAnnotation
  | CodeAnnotation
  | LinkAnnotation
  | ImageAnnotation
  | ReferenceAnnotation;

export type BodyAnnotation = InlineAnnotation | BlockAnnotation;

export type TextDocument = {
  text: string;
  annotations: InlineAnnotation[];
};

export type BodyDocument = {
  text: string;
  annotations: BodyAnnotation[];
};

export type DgDocument = {
  version: typeof DG_DOCUMENT_VERSION;
  title: TextDocument;
  body: BodyDocument;
  metadata?: JsonObject;
};

export type Annotation = InlineAnnotation | BlockAnnotation;

export const isBlockAnnotation = (
  annotation: Annotation,
): annotation is BlockAnnotation => annotation.type === "block";

export const isInlineAnnotation = (
  annotation: Annotation,
): annotation is InlineAnnotation => annotation.type !== "block";
