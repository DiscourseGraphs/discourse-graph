import { DiscourseNode } from "~/types";

export function validateNodeFormat(
  format: string,
  nodeTypes: DiscourseNode[],
): {
  isValid: boolean;
  error?: string;
} {
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

  const { isValid, error } = validateFormatUniqueness(nodeTypes);
  if (!isValid) {
    return { isValid: false, error };
  }

  return { isValid: true };
}

const validateFormatUniqueness = (
  nodeTypes: DiscourseNode[],
): { isValid: boolean; error?: string } => {
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
): { isValid: boolean; error?: string } => {
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
