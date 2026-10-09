import {
  CONTENT_PLACEHOLDER,
  FORMAT_PLACEHOLDER,
} from "@repo/database/lib/decorateTitle";
import { DiscourseNode } from "~/types";

type ValidationResult = {
  isValid: boolean;
  error?: string;
};

export const validateNodeFormat = ({
  format,
  currentNode,
  allNodes,
}: {
  format: string;
  currentNode: DiscourseNode;
  allNodes: DiscourseNode[];
}): ValidationResult => {
  if (!format) {
    return {
      isValid: false,
      error: "Format cannot be empty",
    };
  }

  if (format.includes("[[") || format.includes("]]")) {
    return {
      isValid: false,
      error: "Format should not contain double brackets [[ or ]]",
    };
  }

  if (!format.includes("{content}")) {
    return {
      isValid: false,
      error: 'Format must include the placeholder "{content}"',
    };
  }

  // Same placeholder rule as decorateTitle, which can't build titles from other placeholders.
  const unsupportedPlaceholders = [
    ...new Set(
      (format.match(FORMAT_PLACEHOLDER) ?? []).filter(
        (placeholder) => placeholder.toLowerCase() !== CONTENT_PLACEHOLDER,
      ),
    ),
  ];
  if (unsupportedPlaceholders.length > 0) {
    return {
      isValid: false,
      error: `Format contains unsupported placeholder${unsupportedPlaceholders.length > 1 ? "s" : ""}: ${unsupportedPlaceholders.join(", ")}. Only ${CONTENT_PLACEHOLDER} is supported.`,
    };
  }

  const invalidCharsResult = checkInvalidChars(format);
  if (!invalidCharsResult.isValid) {
    return invalidCharsResult;
  }

  const otherNodes = allNodes.filter((node) => node.id !== currentNode.id);
  const isDuplicate = otherNodes.some((node) => node.format === format);
  if (isDuplicate) {
    return {
      isValid: false,
      error: "Format must be unique across all node types",
    };
  }

  return { isValid: true };
};

const INVALID_FILENAME_CHARS_REGEX = /[#^[\]|]/;

export const checkInvalidChars = (format: string): ValidationResult => {
  const invalidCharMatch = format.match(INVALID_FILENAME_CHARS_REGEX);
  if (invalidCharMatch) {
    return {
      isValid: false,
      error: `Node contains invalid character: ${invalidCharMatch[0]}. Characters #, ^, [, ], | cannot be used in filenames.`,
    };
  }

  return { isValid: true };
};

export const normalizeImportedNodeFormat = (format: string): string => {
  if (checkInvalidChars(format).isValid) return format;
  // `sanitizeFileName` in importNodes.ts collapses and trims whitespace in
  // imported file names. Do the same here, or a removed ` | ` leaves a double
  // space and the format stops matching those files.
  return format
    .replace(new RegExp(INVALID_FILENAME_CHARS_REGEX, "g"), "")
    .replace(/\s+/g, " ")
    .trim();
};

export const validateNodeName = ({
  name,
  currentNode,
  allNodes,
}: {
  name: string;
  currentNode: DiscourseNode;
  allNodes: DiscourseNode[];
}): ValidationResult => {
  if (!name || name.trim() === "") {
    return { isValid: false, error: "Name is required" };
  }

  const otherNodes = allNodes.filter((node) => node.id !== currentNode.id);
  const isDuplicate = otherNodes.some((node) => node.name === name);

  if (isDuplicate) {
    return { isValid: false, error: "Name must be unique" };
  }

  return { isValid: true };
};

export const validateAllNodes = (
  nodeTypes: DiscourseNode[],
): { hasErrors: boolean; errorMap: Record<number, string> } => {
  const errorMap: Record<number, string> = {};
  let hasErrors = false;
  nodeTypes.forEach((nodeType, index) => {
    if (!nodeType?.name || !nodeType?.format) {
      errorMap[index] = "Name and format are required";
      hasErrors = true;
      return;
    }

    const formatValidation = validateNodeFormat({
      format: nodeType.format,
      currentNode: nodeType,
      allNodes: nodeTypes,
    });
    if (!formatValidation.isValid) {
      errorMap[index] = formatValidation.error || "Invalid format";
      hasErrors = true;
      return;
    }

    const nameValidation = validateNodeName({
      name: nodeType.name,
      currentNode: nodeType,
      allNodes: nodeTypes,
    });
    if (!nameValidation.isValid) {
      errorMap[index] = nameValidation.error || "Invalid name";
      hasErrors = true;
      return;
    }
  });

  return { hasErrors, errorMap };
};
