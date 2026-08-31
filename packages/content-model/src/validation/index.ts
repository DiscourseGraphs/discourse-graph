import {
  dgDocumentSchemaVersion,
  type DgAnnotation,
  type DgBlockAnnotation,
  type DgDocument,
} from "../schema";

export type ValidationIssue = {
  path: readonly string[];
  message: string;
};

export type ValidationResult =
  | {
      success: true;
      issues: readonly [];
    }
  | {
      success: false;
      issues: readonly ValidationIssue[];
    };

const INLINE_TYPES = new Set([
  "bold",
  "italic",
  "strikethrough",
  "inline-code",
  "link",
  "reference",
]);
const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "list-item",
  "blockquote",
  "code-block",
]);
const REFERENCE_TYPES = new Set(["page", "block", "image", "tag"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const addIssue = ({
  issues,
  path,
  message,
}: {
  issues: ValidationIssue[];
  path: readonly string[];
  message: string;
}): void => {
  issues.push({ path, message });
};

const validateSpan = ({
  annotation,
  textLength,
  path,
  issues,
}: {
  annotation: Record<string, unknown>;
  textLength: number;
  path: readonly string[];
  issues: ValidationIssue[];
}): void => {
  const { start, end } = annotation;
  if (!Number.isInteger(start) || !Number.isInteger(end)) {
    addIssue({
      issues,
      path,
      message: "Annotation ranges must use integer start and end offsets.",
    });
    return;
  }
  if ((start as number) < 0 || (end as number) < (start as number)) {
    addIssue({
      issues,
      path,
      message: "Annotation ranges must be ordered and non-negative.",
    });
  }
  if ((end as number) > textLength) {
    addIssue({
      issues,
      path,
      message: "Annotation ranges must stay within their text field.",
    });
  }
};

const validateBlockAttributes = ({
  annotation,
  path,
  issues,
}: {
  annotation: Record<string, unknown>;
  path: readonly string[];
  issues: ValidationIssue[];
}): void => {
  const attributes = annotation.attributes;
  if (attributes === undefined) return;
  if (!isRecord(attributes)) {
    addIssue({
      issues,
      path: [...path, "attributes"],
      message: "Expected an object.",
    });
    return;
  }

  if (
    attributes.level !== undefined &&
    (!Number.isInteger(attributes.level) ||
      (attributes.level as number) < 1 ||
      (attributes.level as number) > 6)
  ) {
    addIssue({
      issues,
      path: [...path, "attributes", "level"],
      message: "Heading levels must be integers from 1 through 6.",
    });
  }
  if (
    attributes.depth !== undefined &&
    (!Number.isInteger(attributes.depth) || (attributes.depth as number) < 0)
  ) {
    addIssue({
      issues,
      path: [...path, "attributes", "depth"],
      message: "Block depth must be a non-negative integer.",
    });
  }
  if (
    attributes.listStyle !== undefined &&
    attributes.listStyle !== "bullet" &&
    attributes.listStyle !== "number"
  ) {
    addIssue({
      issues,
      path: [...path, "attributes", "listStyle"],
      message: 'List style must be either "bullet" or "number".',
    });
  }
};

const validateAnnotation = ({
  value,
  textLength,
  allowBlocks,
  path,
  issues,
}: {
  value: unknown;
  textLength: number;
  allowBlocks: boolean;
  path: readonly string[];
  issues: ValidationIssue[];
}): DgAnnotation | null => {
  if (!isRecord(value)) {
    addIssue({ issues, path, message: "Expected an annotation object." });
    return null;
  }

  validateSpan({ annotation: value, textLength, path, issues });
  if (typeof value.type !== "string") {
    addIssue({
      issues,
      path: [...path, "type"],
      message: "Expected an annotation type.",
    });
    return null;
  }

  if (value.type === "block") {
    if (!allowBlocks) {
      addIssue({
        issues,
        path,
        message: "Title text cannot contain block annotations.",
      });
    }
    if (typeof value.id !== "string" || value.id.trim() === "") {
      addIssue({
        issues,
        path: [...path, "id"],
        message: "Block ids cannot be empty.",
      });
    }
    if (value.parentId !== undefined && typeof value.parentId !== "string") {
      addIssue({
        issues,
        path: [...path, "parentId"],
        message: "Parent ids must be strings.",
      });
    }
    if (
      typeof value.blockType !== "string" ||
      !BLOCK_TYPES.has(value.blockType)
    ) {
      addIssue({
        issues,
        path: [...path, "blockType"],
        message: "Expected a supported block type.",
      });
    }
    validateBlockAttributes({ annotation: value, path, issues });
    return value as DgBlockAnnotation;
  }

  if (!INLINE_TYPES.has(value.type)) {
    addIssue({
      issues,
      path: [...path, "type"],
      message: "Expected a supported inline type.",
    });
    return null;
  }

  if (
    value.type === "link" &&
    (typeof value.href !== "string" || value.href.trim() === "")
  ) {
    addIssue({
      issues,
      path: [...path, "href"],
      message: "Link targets cannot be empty.",
    });
  }
  if (value.type === "reference") {
    if (
      typeof value.referenceType !== "string" ||
      !REFERENCE_TYPES.has(value.referenceType)
    ) {
      addIssue({
        issues,
        path: [...path, "referenceType"],
        message: "Expected a supported reference type.",
      });
    }
    if (typeof value.target !== "string" || value.target.trim() === "") {
      addIssue({
        issues,
        path: [...path, "target"],
        message: "Reference targets cannot be empty.",
      });
    }
  }
  return value as DgAnnotation;
};

const validateText = ({
  value,
  path,
  allowBlocks,
  issues,
}: {
  value: unknown;
  path: readonly string[];
  allowBlocks: boolean;
  issues: ValidationIssue[];
}): DgAnnotation[] => {
  if (!isRecord(value)) {
    addIssue({ issues, path, message: "Expected a text object." });
    return [];
  }
  if (typeof value.text !== "string") {
    addIssue({
      issues,
      path: [...path, "text"],
      message: "Expected text to be a string.",
    });
  }
  if (!Array.isArray(value.annotations)) {
    addIssue({
      issues,
      path: [...path, "annotations"],
      message: "Expected annotations to be an array.",
    });
    return [];
  }

  const textLength = typeof value.text === "string" ? value.text.length : 0;
  return value.annotations.flatMap((annotation, index) => {
    const parsed = validateAnnotation({
      value: annotation,
      textLength,
      allowBlocks,
      path: [...path, "annotations", String(index)],
      issues,
    });
    return parsed === null ? [] : [parsed];
  });
};

const validateBlockRelationships = ({
  annotations,
  issues,
}: {
  annotations: readonly DgAnnotation[];
  issues: ValidationIssue[];
}): void => {
  const blocks = annotations.filter(
    (annotation): annotation is DgBlockAnnotation =>
      annotation.type === "block",
  );
  const blocksById = new Map<string, DgBlockAnnotation>();

  blocks.forEach((block, index) => {
    if (blocksById.has(block.id)) {
      addIssue({
        issues,
        path: ["body", "annotations", String(index), "id"],
        message: `Block id "${block.id}" is duplicated.`,
      });
    }
    blocksById.set(block.id, block);
  });

  blocks.forEach((block, index) => {
    if (block.parentId === undefined) return;
    if (!blocksById.has(block.parentId)) {
      addIssue({
        issues,
        path: ["body", "annotations", String(index), "parentId"],
        message: `Parent block "${block.parentId}" does not exist.`,
      });
      return;
    }

    const visited = new Set([block.id]);
    let parentId: string | undefined = block.parentId;
    while (parentId !== undefined) {
      if (visited.has(parentId)) {
        addIssue({
          issues,
          path: ["body", "annotations", String(index), "parentId"],
          message: "Block parent relationships cannot contain cycles.",
        });
        break;
      }
      visited.add(parentId);
      parentId = blocksById.get(parentId)?.parentId;
    }
  });
};

export const createValidResult = (): ValidationResult => ({
  success: true,
  issues: [],
});

export const validateDgDocument = (value: unknown): ValidationResult => {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) {
    return {
      success: false,
      issues: [{ path: [], message: "Expected a DgDocument object." }],
    };
  }

  if (value.version !== dgDocumentSchemaVersion) {
    addIssue({
      issues,
      path: ["version"],
      message: `DgDocument version must be ${dgDocumentSchemaVersion}.`,
    });
  }
  validateText({
    value: value.title,
    path: ["title"],
    allowBlocks: false,
    issues,
  });
  const bodyAnnotations = validateText({
    value: value.body,
    path: ["body"],
    allowBlocks: true,
    issues,
  });

  if (isRecord(value.title) && typeof value.title.text === "string") {
    if (value.title.text.trim() === "") {
      addIssue({
        issues,
        path: ["title", "text"],
        message: "Document titles cannot be empty.",
      });
    }
    if (value.title.text.includes("\n") || value.title.text.includes("\r")) {
      addIssue({
        issues,
        path: ["title", "text"],
        message: "Document titles must use a single line.",
      });
    }
  }
  validateBlockRelationships({ annotations: bodyAnnotations, issues });

  return issues.length === 0 ? createValidResult() : { success: false, issues };
};

export const isDgDocument = (value: unknown): value is DgDocument =>
  validateDgDocument(value).success;

export const assertDgDocument = (value: unknown): DgDocument => {
  const result = validateDgDocument(value);
  if (!result.success) {
    const message = result.issues
      .map((issue) => `${issue.path.join(".") || "document"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid DgDocument: ${message}`);
  }
  return value as DgDocument;
};
