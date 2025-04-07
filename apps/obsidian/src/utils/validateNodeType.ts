import { DiscourseNode } from "~/types";

type ValidationResult = {
  isValid: boolean;
  error?: string;
};

export function validateNodeFormat(
  format: string,
  nodeTypes: DiscourseNode[],
): ValidationResult {
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

  const invalidCharsResult = checkInvalidChars(format);
  if (!invalidCharsResult.isValid) {
    return invalidCharsResult;
  }

  const uniquenessResult = validateFormatUniqueness(nodeTypes);
  if (!uniquenessResult.isValid) {
    return uniquenessResult;
  }

  return { isValid: true };
}

export const checkInvalidChars = (format: string): ValidationResult => {
  const INVALID_FILENAME_CHARS_REGEX = /[#^\[\]|]/;
  const invalidCharMatch = format.match(INVALID_FILENAME_CHARS_REGEX);
  if (invalidCharMatch) {
    return {
      isValid: false,
      error: `Node contains invalid character: ${invalidCharMatch[0]}. Characters #, ^, [, ], | cannot be used in filenames.`,
    };
  }

  return { isValid: true };
};

const validateFormatUniqueness = (
  nodeTypes: DiscourseNode[],
): ValidationResult => {
  const isDuplicate =
    new Set(nodeTypes.map((nodeType) => nodeType.format)).size !==
    nodeTypes.length;

  if (isDuplicate) {
    return { isValid: false, error: "Format must be unique" };
  }

  return { isValid: true };
};

export const validateNodeName = (
  name: string,
  nodeTypes: DiscourseNode[],
): ValidationResult => {
  if (!name || name.trim() === "") {
    return { isValid: false, error: "Name is required" };
  }

  const isDuplicate =
    new Set(nodeTypes.map((nodeType) => nodeType.name)).size !==
    nodeTypes.length;

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

    const formatValidation = validateNodeFormat(nodeType.format, nodeTypes);
    if (!formatValidation.isValid) {
      errorMap[index] = formatValidation.error || "Invalid format";
      hasErrors = true;
      return;
    }

    const nameValidation = validateNodeName(nodeType.name, nodeTypes);
    if (!nameValidation.isValid) {
      errorMap[index] = nameValidation.error || "Invalid name";
      hasErrors = true;
      return;
    }
  });

  return { hasErrors, errorMap };
};
