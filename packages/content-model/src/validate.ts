import { DG_DOCUMENT_VERSION } from "./constants";
import type {
  Annotation,
  BlockAnnotation,
  BodyAnnotation,
  DgDocument,
  InlineAnnotation,
} from "./schema";
import { isBlockAnnotation } from "./schema";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
};

const validateSpan = ({
  annotation,
  textLength,
  path,
}: {
  annotation: Annotation;
  textLength: number;
  path: string;
}): string[] => {
  const errors: string[] = [];
  if (
    !Number.isInteger(annotation.start) ||
    !Number.isInteger(annotation.end)
  ) {
    errors.push(`${path} span must use integer offsets`);
  }
  if (annotation.start < 0 || annotation.end < 0) {
    errors.push(`${path} span cannot be negative`);
  }
  if (annotation.start >= annotation.end) {
    errors.push(`${path} span must be non-empty`);
  }
  if (annotation.end > textLength) {
    errors.push(`${path} span exceeds text length`);
  }
  return errors;
};

const validateReference = ({
  annotation,
  path,
}: {
  annotation: InlineAnnotation;
  path: string;
}): string[] => {
  if (annotation.type !== "reference") return [];
  const { attributes } = annotation;
  if (attributes.kind === "roam-page" && !attributes.pageTitle.trim()) {
    return [`${path} roam-page reference requires pageTitle`];
  }
  if (attributes.kind === "roam-block" && !attributes.blockUid.trim()) {
    return [`${path} roam-block reference requires blockUid`];
  }
  if (attributes.kind === "obsidian-wikilink" && !attributes.path.trim()) {
    return [`${path} obsidian-wikilink reference requires path`];
  }
  return [];
};

const validateInlineAnnotation = ({
  annotation,
  textLength,
  path,
}: {
  annotation: InlineAnnotation;
  textLength: number;
  path: string;
}): string[] => [
  ...validateSpan({ annotation, textLength, path }),
  ...validateReference({ annotation, path }),
];

const validateBlockParents = (annotations: BodyAnnotation[]): string[] => {
  const blocks = annotations.filter(isBlockAnnotation);
  const blockIds = new Set(blocks.map((block) => block.attributes.blockId));
  const errors: string[] = [];
  for (const block of blocks) {
    if (!block.attributes.blockId.trim()) {
      errors.push("body block annotation requires blockId");
    }
    const parentBlockId = block.attributes.parentBlockId;
    if (parentBlockId && !blockIds.has(parentBlockId)) {
      errors.push(
        `body block ${block.attributes.blockId} references missing parent ${parentBlockId}`,
      );
    }
    if (block.attributes.depth < 0) {
      errors.push(
        `body block ${block.attributes.blockId} depth cannot be negative`,
      );
    }
  }
  return errors;
};

export const validateTextDocument = ({
  text,
  annotations,
  path,
}: {
  text: string;
  annotations: InlineAnnotation[];
  path: string;
}): string[] =>
  annotations.flatMap((annotation, index) =>
    validateInlineAnnotation({
      annotation,
      textLength: text.length,
      path: `${path}.annotations[${index}]`,
    }),
  );

export const validateBodyDocument = ({
  text,
  annotations,
}: {
  text: string;
  annotations: BodyAnnotation[];
}): string[] => [
  ...annotations.flatMap((annotation, index) => {
    const path = `body.annotations[${index}]`;
    if (isBlockAnnotation(annotation)) {
      return validateSpan({ annotation, textLength: text.length, path });
    }
    return validateInlineAnnotation({
      annotation,
      textLength: text.length,
      path,
    });
  }),
  ...validateBlockParents(annotations),
];

export const validateDgDocument = (document: DgDocument): ValidationResult => {
  const errors: string[] = [];
  const expectedVersion: string = DG_DOCUMENT_VERSION;
  if (document.version !== expectedVersion) {
    errors.push(`version must be ${expectedVersion}`);
  }
  errors.push(
    ...validateTextDocument({
      text: document.title.text,
      annotations: document.title.annotations,
      path: "title",
    }),
  );
  errors.push(
    ...document.title.annotations
      .filter((annotation) => isBlockAnnotation(annotation as Annotation))
      .map(() => "title annotations cannot contain block annotations"),
  );
  errors.push(...validateBodyDocument(document.body));
  return {
    valid: errors.length === 0,
    errors,
  };
};

export const assertValidDgDocument = (document: DgDocument): void => {
  const result = validateDgDocument(document);
  if (!result.valid) {
    throw new Error(result.errors.join("\n"));
  }
};

export const getBlockAnnotations = (document: DgDocument): BlockAnnotation[] =>
  document.body.annotations.filter(isBlockAnnotation);
