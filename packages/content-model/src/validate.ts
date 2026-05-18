import { DG_DOCUMENT_VERSION, NULL_INLINE_CONTENT } from "./constants";
import type {
  BodyAnnotation,
  BlockAnnotation,
  DgDocument,
  InlineAnnotation,
  ReferenceAnnotation,
} from "./schema";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const validateSpan = ({
  annotation,
  length,
  path,
}: {
  annotation: BodyAnnotation | InlineAnnotation;
  length: number;
  path: string;
}): string[] => {
  const errors: string[] = [];
  if (!Number.isFinite(annotation.start)) {
    errors.push(`${path} has invalid start`);
  }
  if (!Number.isFinite(annotation.end)) {
    errors.push(`${path} has invalid end`);
  }
  if (errors.length > 0) {
    return errors;
  }
  if (annotation.start < 0) {
    errors.push(`${path} has negative start`);
  }
  if (annotation.end <= annotation.start) {
    errors.push(`${path} has zero or negative length`);
  }
  if (annotation.end > length) {
    errors.push(`${path} exceeds document length`);
  }
  return errors;
};

const validateReference = (
  annotation: ReferenceAnnotation,
  path: string,
): string[] => {
  const attributes = annotation.attributes as
    | {
        kind?: unknown;
        pageTitle?: unknown;
        blockUid?: unknown;
        path?: unknown;
      }
    | undefined;
  if (!attributes) {
    return [`${path} reference is missing attributes`];
  }
  if (
    attributes.kind === "roam-page" &&
    (typeof attributes.pageTitle !== "string" ||
      attributes.pageTitle.length === 0)
  ) {
    return [`${path} roam-page reference is missing pageTitle`];
  }
  if (
    attributes.kind === "roam-block" &&
    (typeof attributes.blockUid !== "string" ||
      attributes.blockUid.length === 0)
  ) {
    return [`${path} roam-block reference is missing blockUid`];
  }
  if (
    attributes.kind === "obsidian-wikilink" &&
    (typeof attributes.path !== "string" || attributes.path.length === 0)
  ) {
    return [`${path} obsidian-wikilink reference is missing path`];
  }
  if (
    attributes.kind !== "roam-page" &&
    attributes.kind !== "roam-block" &&
    attributes.kind !== "obsidian-wikilink"
  ) {
    return [`${path} reference has unknown kind`];
  }
  return [];
};

const validateBlockAnnotation = (
  annotation: BlockAnnotation,
  path: string,
): string[] => {
  const errors: string[] = [];
  const attributes = annotation.attributes;
  if (!attributes) {
    return [`${path} block is missing attributes`];
  }
  if (!attributes.blockId) {
    errors.push(`${path} block is missing blockId`);
  }
  if (!Number.isInteger(attributes.depth) || attributes.depth < 0) {
    errors.push(`${path} block has invalid depth`);
  }
  if (
    attributes.viewType !== "paragraph" &&
    attributes.viewType !== "bullet" &&
    attributes.viewType !== "numbered"
  ) {
    errors.push(`${path} block has invalid viewType`);
  }
  return errors;
};

const validateInlineAnnotations = ({
  annotations,
  length,
  path,
}: {
  annotations: Array<InlineAnnotation | BodyAnnotation>;
  length: number;
  path: string;
}): string[] => {
  return annotations.flatMap((annotation, index) => {
    const annotationPath = `${path}.annotations[${index}]`;
    return [
      ...validateSpan({ annotation, length, path: annotationPath }),
      ...(annotation.type === "block"
        ? [`${annotationPath} title cannot contain block annotations`]
        : []),
      ...(annotation.type === "reference"
        ? validateReference(annotation, annotationPath)
        : []),
    ];
  });
};

export const validateDgDocument = (document: DgDocument): ValidationResult => {
  const errors: string[] = [];

  if (document.version !== DG_DOCUMENT_VERSION) {
    errors.push("version must be dg-content-model/v1");
  }

  errors.push(
    ...validateInlineAnnotations({
      annotations: document.title.annotations,
      length: document.title.text.length,
      path: "title",
    }),
  );

  const blockIds = new Set<string>();
  for (const [index, annotation] of document.body.annotations.entries()) {
    const path = `body.annotations[${index}]`;
    errors.push(
      ...validateSpan({
        annotation,
        length: document.body.text.length,
        path,
      }),
    );

    if (annotation.type === "reference") {
      errors.push(...validateReference(annotation, path));
    }

    if (annotation.type === "block") {
      errors.push(...validateBlockAnnotation(annotation, path));
      if (
        annotation.attributes?.blockId &&
        blockIds.has(annotation.attributes.blockId)
      ) {
        errors.push(
          `${path} duplicate blockId ${annotation.attributes.blockId}`,
        );
      }
      if (annotation.attributes?.blockId) {
        blockIds.add(annotation.attributes.blockId);
      }
    }
  }

  for (const [index, annotation] of document.body.annotations.entries()) {
    if (annotation.type !== "block") continue;
    const parentBlockId = annotation.attributes?.parentBlockId;
    if (parentBlockId && !blockIds.has(parentBlockId)) {
      errors.push(
        `body.annotations[${index}] parentBlockId ${parentBlockId} does not exist`,
      );
    }
  }

  if (document.title.text.includes(NULL_INLINE_CONTENT)) {
    errors.push("title text cannot contain null inline placeholder");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const assertValidDgDocument = (document: DgDocument): void => {
  const result = validateDgDocument(document);
  if (!result.valid) {
    throw new Error(`Invalid DG document:\n${result.errors.join("\n")}`);
  }
};
