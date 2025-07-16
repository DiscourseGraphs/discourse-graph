import { DiscourseNode } from "~/types";

type ValidationResult = {
  isValid: boolean;
  error?: string;
};

export function validateNodeFormat({
  format,
  currentNode,
  allNodes,
}: {
  format: string;
  currentNode: DiscourseNode;
  allNodes: DiscourseNode[];
}): ValidationResult {
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

  const otherNodes = allNodes.filter((node) => node.id !== currentNode.id);
  const isDuplicate = otherNodes.some((node) => node.format === format);
  if (isDuplicate) {
    return {
      isValid: false,
      error: "Format must be unique across all node types",
    };
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
